import { describe, expect, it } from "vitest";

import { createPostRunsHandler } from "../src/app/api/runs/route";
import { createCancelBrowserHandler } from "../src/app/api/runs/[id]/cancel/route";
import { createConfirmTargetHandler } from "../src/app/api/runs/[id]/confirm/route";
import { createExecuteBrowserHandler } from "../src/app/api/runs/[id]/execute/route";
import { createResumeBrowserHandler } from "../src/app/api/runs/[id]/resume/route";
import type { CredentialPlan } from "../src/domain/credential-plan";
import type { PlannedRunSnapshot } from "../src/domain/run";

const signupPlan: CredentialPlan = {
  inputMode: "direct",
  appName: "Example Service",
  selectionReason: "The user named it.",
  clarificationQuestion: null,
  requiresConfirmation: false,
  path: "signup_required",
  credentialTypes: ["api_key"],
  summary: "Create an account and issue a key.",
  signupUrl: "https://accounts.example.test/register",
  blocker: null,
  officialSources: ["https://developers.example.test/api-keys"],
};

const discoveryPlan: CredentialPlan = {
  ...signupPlan,
  inputMode: "discovery",
  appName: "Selected Service",
  selectionReason: "It is the strongest official-source match for the requested capabilities.",
  requiresConfirmation: true,
};

describe("complete reviewer journeys", () => {
  it("runs direct input through human pause and validated same-session success", async () => {
    let stored: PlannedRunSnapshot | undefined;
    const start = createPostRunsHandler({
      buildPlan: async () => signupPlan,
      saveRun: (run) => (stored = run),
    });
    await start(
      new Request("http://localhost/api/runs", {
        method: "POST",
        body: JSON.stringify({ query: "Example Service" }),
      }),
    );
    const id = stored!.id;
    const execute = createExecuteBrowserHandler({
      findRun: () => stored,
      saveRun: (run) => (stored = run),
      executePlan: async () => ({
        status: "awaiting_human",
        sessionId: "same-session",
        liveViewUrl: "https://www.browserbase.com/live/same-session",
        currentUrl: "https://accounts.example.test/verify",
        intervention: {
          id: "otp-1",
          kind: "otp",
          prompt: "Enter the OTP.",
          reason: "Email verification is required.",
          sensitive: true,
        },
      }),
    });
    await execute(new Request("http://localhost"), {
      params: Promise.resolve({ id }),
    });
    expect(stored?.state).toBe("awaiting_human");

    const resume = createResumeBrowserHandler({
      findRun: () => stored,
      saveRun: (run) => (stored = run),
      resumeRun: async (sessionId) => ({
        status: "validated_success",
        sessionId,
        currentUrl: "https://developers.example.test/settings/keys",
        appName: "Example Service",
        credentialType: "api_key",
        credential: "secret-example-1234",
        sourceUrl: "https://developers.example.test/settings/keys",
        usageNote: "Use the documented Authorization header.",
        validationNote: "Official read-only check accepted it.",
      }),
    });
    await resume(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ interventionId: "otp-1", value: "123456" }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(stored).toMatchObject({
      state: "validated_success",
      browser: undefined,
      result: { status: "validated_success", credential: "secret-example-1234" },
    });
  });

  it("requires confirmation for a discovered target before no-human browser success", async () => {
    let stored: PlannedRunSnapshot | undefined;
    const start = createPostRunsHandler({
      buildPlan: async () => discoveryPlan,
      saveRun: (run) => (stored = run),
    });
    await start(
      new Request("http://localhost/api/runs", {
        method: "POST",
        body: JSON.stringify({ query: "A free email API for a small prototype" }),
      }),
    );
    expect(stored?.state).toBe("awaiting_target_confirmation");

    const confirm = createConfirmTargetHandler({
      findRun: () => stored,
      saveRun: (run) => (stored = run),
      now: () => new Date("2026-08-08T12:00:00.000Z"),
    });
    await confirm(new Request("http://localhost"), {
      params: Promise.resolve({ id: stored!.id }),
    });
    expect(stored).toMatchObject({
      state: "planning",
      targetConfirmedAt: "2026-08-08T12:00:00.000Z",
    });

    const execute = createExecuteBrowserHandler({
      findRun: () => stored,
      saveRun: (run) => (stored = run),
      executePlan: async () => ({
        status: "obtained_unverified",
        sessionId: "discovery-session",
        currentUrl: "https://developers.example.test/settings/keys",
        appName: "Selected Service",
        credentialType: "api_key",
        credential: "selected-service-key",
        sourceUrl: "https://developers.example.test/settings/keys",
        usageNote: "Use the documented Authorization header.",
        validationNote: "No harmless validation endpoint was available.",
      }),
    });
    await execute(new Request("http://localhost"), {
      params: Promise.resolve({ id: stored!.id }),
    });

    expect(stored).toMatchObject({
      state: "obtained_unverified",
      result: {
        status: "obtained_unverified",
        credential: "selected-service-key",
      },
    });
  });

  it("returns a documented public credential without opening a browser", async () => {
    let stored: PlannedRunSnapshot | undefined;
    const start = createPostRunsHandler({
      buildPlan: async () => ({
        ...signupPlan,
        path: "public_credential",
        credentialTypes: ["public_demo_key"],
        signupUrl: null,
        publicCredential: {
          credentialType: "public_demo_key",
          credential: "official-public-demo-key",
          sourceUrl: "https://developers.example.test/demo",
          usageNote: "Use only against the documented demo endpoint.",
          limitations: "This key is public and restricted to demo data.",
        },
      }),
      saveRun: (run) => (stored = run),
    });

    await start(
      new Request("http://localhost/api/runs", {
        method: "POST",
        body: JSON.stringify({ query: "Example Service public demo API" }),
      }),
    );

    expect(stored).toMatchObject({
      state: "obtained_unverified",
      result: {
        status: "obtained_unverified",
        credentialType: "public_demo_key",
        credential: "official-public-demo-key",
      },
    });
    expect(stored).not.toHaveProperty("browser");
  });

  it("reports an evidence-backed blocker without starting a browser", async () => {
    let stored: PlannedRunSnapshot | undefined;
    const start = createPostRunsHandler({
      buildPlan: async () => ({
        ...signupPlan,
        path: "blocked",
        signupUrl: null,
        blocker: "Official documentation says API access requires an approved enterprise plan.",
      }),
      saveRun: (run) => (stored = run),
    });

    await start(
      new Request("http://localhost/api/runs", {
        method: "POST",
        body: JSON.stringify({ query: "Example Service" }),
      }),
    );

    expect(stored).toMatchObject({
      state: "blocked",
      result: {
        status: "blocked",
        stage: "planning",
        reason: "Official documentation says API access requires an approved enterprise plan.",
      },
    });
    expect(stored).not.toHaveProperty("browser");
  });

  it("cancels an active browser journey and removes takeover access", async () => {
    let stored: PlannedRunSnapshot = {
      id: "run-cancel",
      query: "Example Service",
      state: "awaiting_human",
      createdAt: new Date().toISOString(),
      plan: signupPlan,
      browser: {
        sessionId: "cancel-session",
        liveViewUrl: "https://www.browserbase.com/live/cancel-session",
        currentUrl: "https://accounts.example.test/verify",
        intervention: {
          id: "captcha-1",
          kind: "captcha",
          prompt: "Complete the CAPTCHA.",
          reason: "Human verification is required.",
          sensitive: false,
        },
      },
    };
    const cancel = createCancelBrowserHandler({
      findRun: () => stored,
      saveRun: (run) => (stored = run),
      cancelRun: () => true,
    });

    await cancel(new Request("http://localhost"), {
      params: Promise.resolve({ id: stored.id }),
    });

    expect(stored).toMatchObject({
      state: "cancelled",
      browser: undefined,
      result: { status: "cancelled", stage: "awaiting_human" },
    });
  });

  it("surfaces the browser deadline as a distinct timeout result", async () => {
    let stored: PlannedRunSnapshot = {
      id: "run-timeout",
      query: "Example Service",
      state: "planning",
      createdAt: new Date().toISOString(),
      plan: signupPlan,
    };
    const execute = createExecuteBrowserHandler({
      findRun: () => stored,
      saveRun: (run) => (stored = run),
      executePlan: async () => ({
        status: "timed_out",
        reason: "The 12-minute browser deadline expired.",
      }),
    });

    await execute(new Request("http://localhost"), {
      params: Promise.resolve({ id: stored.id }),
    });

    expect(stored).toMatchObject({
      state: "timed_out",
      browser: undefined,
      result: {
        status: "timed_out",
        reason: "The 12-minute browser deadline expired.",
      },
    });
  });

  it("turns browser dependency failure into a distinct terminal result", async () => {
    let stored: PlannedRunSnapshot = {
      id: "run-failure",
      query: "Example Service",
      state: "planning",
      createdAt: new Date().toISOString(),
      plan: signupPlan,
    };
    const execute = createExecuteBrowserHandler({
      findRun: () => stored,
      saveRun: (run) => (stored = run),
      executePlan: async () => {
        throw new Error("provider detail that must not leak");
      },
    });

    const response = await execute(new Request("http://localhost"), {
      params: Promise.resolve({ id: stored.id }),
    });

    expect(stored).toMatchObject({
      state: "technical_failure",
      result: { status: "technical_failure" },
    });
    expect(JSON.stringify(await response.json())).not.toContain("provider detail");
  });
});
