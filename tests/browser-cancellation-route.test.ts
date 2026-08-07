import { describe, expect, it, vi } from "vitest";

import { createCancelBrowserHandler } from "../src/app/api/runs/[id]/cancel/route";

describe("POST /api/runs/:id/cancel", () => {
  it("cancels only the active browsing run and records its state", async () => {
    const run = {
      id: "run-1",
      query: "Example Service",
      state: "browsing" as const,
      createdAt: "2026-08-08T00:00:00.000Z",
    };
    const saveRun = vi.fn();
    const cancelRun = vi.fn().mockReturnValue(true);
    const handler = createCancelBrowserHandler({
      findRun: () => run,
      saveRun,
      cancelRun,
    });

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(cancelRun).toHaveBeenCalledOnce();
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "run-1",
        state: "cancelled",
        result: expect.objectContaining({
          status: "cancelled",
          stage: "browsing",
        }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("does not report cancellation when no matching session is active", async () => {
    const handler = createCancelBrowserHandler({
      findRun: () => ({
        id: "run-1",
        query: "Example Service",
        state: "planning",
        createdAt: "2026-08-08T00:00:00.000Z",
      }),
      saveRun: vi.fn(),
      cancelRun: vi.fn(),
    });

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(409);
  });

  it("cancels while control is paused for a human", async () => {
    const saveRun = vi.fn();
    const handler = createCancelBrowserHandler({
      findRun: () => ({
        id: "run-1",
        query: "Example Service",
        state: "awaiting_human",
        createdAt: "2026-08-08T00:00:00.000Z",
      }),
      saveRun,
      cancelRun: vi.fn().mockReturnValue(true),
    });

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(200);
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({ state: "cancelled" }),
    );
  });
});
