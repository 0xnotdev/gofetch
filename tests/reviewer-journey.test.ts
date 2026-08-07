import { describe, expect, it } from "vitest";

import { createPostRunsHandler } from "../src/app/api/runs/route";
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
