import { describe, expect, it } from "vitest";

import { createConfirmTargetHandler } from "../src/app/api/runs/[id]/confirm/route";

describe("POST /api/runs/:id/confirm", () => {
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
