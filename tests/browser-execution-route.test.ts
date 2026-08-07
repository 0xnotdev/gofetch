import { describe, expect, it, vi } from "vitest";

import { createExecuteBrowserHandler } from "../src/app/api/runs/[id]/execute/route";
import type { PlannedRunSnapshot } from "../src/domain/run";

const plannedRun: PlannedRunSnapshot = {
  id: "run-1",
  query: "Example Service",
  state: "planning",
  createdAt: "2026-08-08T00:00:00.000Z",
  plan: {
    inputMode: "direct",
    appName: "Example Service",
    selectionReason: "The user named it.",
    clarificationQuestion: null,
    requiresConfirmation: false,
    path: "signup_required",
    credentialTypes: ["api_key"],
    summary: "Create an account.",
    signupUrl: "https://accounts.example.test/register",
    blocker: null,
    officialSources: ["https://developers.example.test/api-keys"],
  },
};

describe("POST /api/runs/:id/execute", () => {
  it("executes the stored generic plan and records terminal browser blockers", async () => {
    const saveRun = vi.fn();
    const executePlan = vi.fn().mockResolvedValue({
      status: "blocked",
      sessionId: "session-123",
      reason: "A payment card is required.",
      blocker: "payment_required",
      currentUrl: "https://accounts.example.test/billing",
    });
    const handler = createExecuteBrowserHandler({
      findRun: () => plannedRun,
      saveRun,
      executePlan,
    });

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(200);
    expect(executePlan).toHaveBeenCalledWith(plannedRun.plan);
    expect(saveRun).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ state: "browsing" }),
    );
    expect(saveRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "blocked" }),
    );
    await expect(response.json()).resolves.toMatchObject({
      run: { id: "run-1", state: "blocked" },
      execution: {
        status: "blocked",
        blocker: "payment_required",
      },
    });
  });

  it("rejects execution before a discovered target is confirmed", async () => {
    const handler = createExecuteBrowserHandler({
      findRun: () => ({
        ...plannedRun,
        state: "awaiting_target_confirmation",
        plan: {
          ...plannedRun.plan!,
          inputMode: "discovery",
          requiresConfirmation: true,
        },
      }),
      saveRun: vi.fn(),
      executePlan: vi.fn(),
    });

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "browser_execution_not_available" },
    });
  });

  it("stores only transient session metadata when human control is required", async () => {
    const saveRun = vi.fn();
    const handler = createExecuteBrowserHandler({
      findRun: () => plannedRun,
      saveRun,
      executePlan: vi.fn().mockResolvedValue({
        status: "awaiting_human",
        sessionId: "session-123",
        liveViewUrl: "https://www.browserbase.com/live/session-123",
        currentUrl: "https://accounts.example.test/challenge",
        intervention: {
          id: "intervention-1",
          kind: "captcha",
          prompt: "Complete the CAPTCHA, then hand control back.",
          reason: "CAPTCHAs require human input.",
          sensitive: false,
        },
      }),
    });

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(200);
    expect(saveRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "awaiting_human",
        browser: {
          sessionId: "session-123",
          liveViewUrl: "https://www.browserbase.com/live/session-123",
          currentUrl: "https://accounts.example.test/challenge",
          intervention: expect.objectContaining({ id: "intervention-1" }),
        },
      }),
    );
  });

  it("records an extracted credential as a terminal structured result", async () => {
    const saveRun = vi.fn();
    const handler = createExecuteBrowserHandler({
      findRun: () => plannedRun,
      saveRun,
      executePlan: vi.fn().mockResolvedValue({
        status: "obtained_unverified",
        sessionId: "session-123",
        currentUrl: "https://developers.example.test/settings/keys",
        appName: "Example Service",
        credentialType: "api_key",
        credential: "secret-example-1234",
        sourceUrl: "https://developers.example.test/settings/keys",
        usageNote: "Use the documented Authorization header.",
        validationNote: "No harmless official validation was available.",
      }),
    });

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    const body = await response.json();
    expect(body.run).toMatchObject({
      state: "obtained_unverified",
      result: {
        status: "obtained_unverified",
        credential: "secret-example-1234",
      },
    });
    expect(body.run).not.toHaveProperty("browser");
    expect(body.run.result).not.toHaveProperty("sessionId");
    expect(saveRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "obtained_unverified" }),
    );
  });
});
