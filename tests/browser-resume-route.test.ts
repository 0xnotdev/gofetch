import { describe, expect, it, vi } from "vitest";

import { createResumeBrowserHandler } from "../src/app/api/runs/[id]/resume/route";
import type { PlannedRunSnapshot } from "../src/domain/run";

const pausedRun: PlannedRunSnapshot = {
  id: "run-1",
  query: "Example Service",
  state: "awaiting_human",
  createdAt: "2026-08-08T00:00:00.000Z",
  browser: {
    sessionId: "session-123",
    liveViewUrl: "https://www.browserbase.com/live/session-123",
    currentUrl: "https://accounts.example.test/challenge",
    intervention: {
      id: "intervention-1",
      kind: "otp",
      prompt: "Enter the OTP.",
      reason: "The site requires email verification.",
      sensitive: true,
    },
  },
};

describe("POST /api/runs/:id/resume", () => {
  it("passes a private value directly to the same session and never echoes it", async () => {
    const saveRun = vi.fn();
    const resumeRun = vi.fn().mockResolvedValue({
      status: "completed",
      sessionId: "session-123",
      message: "Verification completed.",
      currentUrl: "https://accounts.example.test/settings",
    });
    const handler = createResumeBrowserHandler({
      findRun: () => pausedRun,
      saveRun,
      resumeRun,
    });

    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interventionId: "intervention-1",
          value: "123456",
        }),
      }),
      { params: Promise.resolve({ id: "run-1" }) },
    );

    expect(resumeRun).toHaveBeenCalledWith("session-123", {
      interventionId: "intervention-1",
      value: "123456",
    });
    expect(saveRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "browsing", browser: undefined }),
    );
    expect(JSON.stringify(await response.json())).not.toContain("123456");
  });

  it("rejects a stale or mismatched intervention", async () => {
    const resumeRun = vi.fn();
    const handler = createResumeBrowserHandler({
      findRun: () => pausedRun,
      saveRun: vi.fn(),
      resumeRun,
    });

    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interventionId: "stale-intervention" }),
      }),
      { params: Promise.resolve({ id: "run-1" }) },
    );

    expect(response.status).toBe(409);
    expect(resumeRun).not.toHaveBeenCalled();
  });
});
