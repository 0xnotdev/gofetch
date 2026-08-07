import { describe, expect, it } from "vitest";

import { createConfirmTargetHandler } from "../src/app/api/runs/[id]/confirm/route";
import { canConfirmTarget } from "../src/run/target-confirmation";

describe("POST /api/runs/:id/confirm", () => {
  it("allows confirmation only while a discovery run is awaiting it", () => {
    const plan = {
      inputMode: "discovery" as const,
      appName: "Fable Mail",
      selectionReason: "It matches the requested capability.",
      clarificationQuestion: null,
      requiresConfirmation: true,
      path: "signup_required" as const,
      credentialTypes: ["api_key" as const],
      summary: "Create an account and issue an API key.",
      signupUrl: "https://fable-mail.test/signup",
      blocker: null,
      officialSources: ["https://docs.fable-mail.test/api-keys"],
    };
    const base = {
      id: "run-state",
      query: "a mail app",
      createdAt: "2026-08-08T00:00:00.000Z",
      plan,
    };

    expect(canConfirmTarget({ ...base, state: "awaiting_target_confirmation" })).toBe(true);
    expect(
      canConfirmTarget({
        ...base,
        state: "needs_clarification",
        result: {
          status: "needs_clarification",
          reason: "Official evidence was incomplete.",
          stage: "planning",
          evidence: plan.officialSources,
        },
      }),
    ).toBe(false);
  });

  it("records confirmation before a discovered app can proceed", async () => {
    const run = {
      id: "run-1",
      query: "an email delivery app with a free API",
      state: "awaiting_target_confirmation" as const,
      createdAt: "2026-08-08T00:00:00.000Z",
      plan: {
        inputMode: "discovery" as const,
        appName: "Fable Mail",
        selectionReason: "It matches the requested capability.",
        clarificationQuestion: null,
        requiresConfirmation: true,
        path: "signup_required" as const,
        credentialTypes: ["api_key" as const],
        summary: "Create an account and issue an API key.",
        signupUrl: "https://fable-mail.test/signup",
        blocker: null,
        officialSources: ["https://docs.fable-mail.test/api-keys"],
      },
    };
    let savedRun: unknown;
    const handler = createConfirmTargetHandler({
      findRun: () => run,
      saveRun: (updated) => {
        savedRun = updated;
      },
      now: () => new Date("2026-08-08T00:01:00.000Z"),
    });

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "run-1",
      state: "planning",
      targetConfirmedAt: "2026-08-08T00:01:00.000Z",
    });
    expect(savedRun).toMatchObject({ state: "planning" });
  });
});
