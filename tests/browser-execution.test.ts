import { describe, expect, it, vi } from "vitest";

import type { CredentialPlan } from "../src/domain/credential-plan";
import {
  BrowserRunCoordinator,
  buildAllowedDomains,
  type BrowserSession,
  type BrowserSessionFactory,
} from "../src/browser/browser-run-coordinator";

const signupPlan: CredentialPlan = {
  inputMode: "direct",
  appName: "Example Service",
  selectionReason: "The user named this service.",
  clarificationQuestion: null,
  requiresConfirmation: false,
  path: "signup_required",
  credentialTypes: ["api_key"],
  summary: "Create an account, then open the developer settings.",
  signupUrl: "https://accounts.example.test/register",
  blocker: null,
  officialSources: [
    "https://developers.example.test/docs/authentication",
    "https://accounts.example.test/register",
  ],
};

function createBrowserFake() {
  const session: BrowserSession = {
    id: "session-123",
    setAllowedDomains: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue({
      kind: "completed",
      summary: "Reached the credential area.",
      currentUrl: "https://accounts.example.test/settings",
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const factory: BrowserSessionFactory = {
    create: vi.fn().mockResolvedValue(session),
  };

  return { factory, session };
}

describe("BrowserRunCoordinator", () => {
  it("builds policy only from secure credential-free official URLs", () => {
    expect(() =>
      buildAllowedDomains(["http://developers.example.test/docs"]),
    ).toThrow("Only secure official URLs may enter the browser domain policy.");
    expect(() =>
      buildAllowedDomains(["https://user:secret@example.test/docs"]),
    ).toThrow("Only secure official URLs may enter the browser domain policy.");
  });

  it("executes a researched signup plan with dynamic domain policy and cleanup", async () => {
    const { factory, session } = createBrowserFake();
    const coordinator = new BrowserRunCoordinator({ factory });

    const result = await coordinator.run(signupPlan);

    expect(factory.create).toHaveBeenCalledOnce();
    expect(session.setAllowedDomains).toHaveBeenCalledWith([
      "accounts.example.test",
      "developers.example.test",
    ]);
    expect(session.navigate).toHaveBeenCalledWith(
      "https://accounts.example.test/register",
      expect.any(AbortSignal),
    );
    expect(session.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: "Example Service",
        planSummary: signupPlan.summary,
        credentialTypes: ["api_key"],
      }),
      expect.any(AbortSignal),
    );
    expect(result).toEqual({
      status: "completed",
      sessionId: "session-123",
      message: "Reached the credential area.",
      currentUrl: "https://accounts.example.test/settings",
    });
    expect(session.close).toHaveBeenCalledOnce();
  });

  it("stops at an observed payment requirement and closes the session", async () => {
    const { factory, session } = createBrowserFake();
    vi.mocked(session.execute).mockResolvedValue({
      kind: "payment_required",
      summary: "A payment card is required before an API key can be created.",
      currentUrl: "https://accounts.example.test/billing",
    });
    const coordinator = new BrowserRunCoordinator({ factory });

    const result = await coordinator.run(signupPlan);

    expect(result).toEqual({
      status: "blocked",
      sessionId: "session-123",
      reason: "A payment card is required before an API key can be created.",
      blocker: "payment_required",
      currentUrl: "https://accounts.example.test/billing",
    });
    expect(session.close).toHaveBeenCalledOnce();
  });

  it("allows only one active browser run", async () => {
    const { factory, session } = createBrowserFake();
    let finishExecution: ((value: {
      kind: "completed";
      summary: string;
      currentUrl: string;
    }) => void) | undefined;
    vi.mocked(session.execute).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishExecution = resolve;
        }),
    );
    const coordinator = new BrowserRunCoordinator({ factory });

    const firstRun = coordinator.run(signupPlan);
    await vi.waitFor(() => expect(session.execute).toHaveBeenCalledOnce());
    const secondResult = await coordinator.run(signupPlan);

    expect(secondResult).toEqual({
      status: "technical_failure",
      reason: "Another browser run is already active.",
    });
    expect(factory.create).toHaveBeenCalledOnce();

    finishExecution?.({
      kind: "completed",
      summary: "Done.",
      currentUrl: "https://accounts.example.test/settings",
    });
    await firstRun;
  });

  it("rejects a run before opening a session when the configured quota is exhausted", async () => {
    const { factory } = createBrowserFake();
    const coordinator = new BrowserRunCoordinator({
      factory,
      maxSessionStarts: 1,
    });

    await coordinator.run(signupPlan);
    const result = await coordinator.run(signupPlan);

    expect(result).toEqual({
      status: "technical_failure",
      reason: "The configured browser-session quota is exhausted.",
    });
    expect(factory.create).toHaveBeenCalledOnce();
  });

  it("throttles rapid repeat session starts", async () => {
    const { factory } = createBrowserFake();
    let now = 1_000;
    const coordinator = new BrowserRunCoordinator({
      factory,
      maxSessionStarts: 2,
      minRunIntervalMs: 1_000,
      now: () => now,
    });

    await coordinator.run(signupPlan);
    now = 1_500;
    const result = await coordinator.run(signupPlan);

    expect(result).toEqual({
      status: "technical_failure",
      reason: "A new browser session was requested too soon after the previous run.",
    });
    expect(factory.create).toHaveBeenCalledOnce();
  });

  it("times out at the configured ceiling and closes the session", async () => {
    const { factory, session } = createBrowserFake();
    vi.mocked(session.execute).mockImplementation((_request, signal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    });
    const coordinator = new BrowserRunCoordinator({
      factory,
      maxRunDurationMs: 5,
    });

    const result = await coordinator.run(signupPlan);

    expect(result).toEqual({
      status: "timed_out",
      reason: "The browser run exceeded its 12-minute safety limit.",
    });
    expect(session.close).toHaveBeenCalledOnce();
  });

  it("cancels the active run and closes the session", async () => {
    const { factory, session } = createBrowserFake();
    vi.mocked(session.execute).mockImplementation((_request, signal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    });
    const coordinator = new BrowserRunCoordinator({ factory });

    const run = coordinator.run(signupPlan);
    await vi.waitFor(() => expect(session.execute).toHaveBeenCalledOnce());
    expect(coordinator.cancel()).toBe(true);

    await expect(run).resolves.toEqual({
      status: "cancelled",
      reason: "The browser run was cancelled by the user.",
    });
    expect(session.close).toHaveBeenCalledOnce();
    expect(coordinator.cancel()).toBe(false);
  });

  it("releases the one-run lock even when best-effort session cleanup fails", async () => {
    const first = createBrowserFake();
    const second = createBrowserFake();
    vi.mocked(first.session.close).mockRejectedValue(new Error("close failed"));
    const factory: BrowserSessionFactory = {
      create: vi
        .fn()
        .mockResolvedValueOnce(first.session)
        .mockResolvedValueOnce(second.session),
    };
    const coordinator = new BrowserRunCoordinator({
      factory,
      maxSessionStarts: 2,
      minRunIntervalMs: 0,
    });

    await expect(coordinator.run(signupPlan)).resolves.toMatchObject({
      status: "completed",
    });
    await expect(coordinator.run(signupPlan)).resolves.toMatchObject({
      status: "completed",
    });
    expect(factory.create).toHaveBeenCalledTimes(2);
  });
});
