import { describe, expect, it } from "vitest";

import type { CredentialPlan } from "../src/domain/credential-plan";
import {
  createCredentialResult,
  maskCredential,
  redactSecrets,
} from "../src/credential/credential-result";

const plan: CredentialPlan = {
  inputMode: "discovery",
  appName: "Example Service",
  selectionReason: "It matches the requested capability.",
  clarificationQuestion: null,
  requiresConfirmation: true,
  path: "signup_required",
  credentialTypes: ["api_key"],
  summary: "Create an account and issue an API key.",
  signupUrl: "https://accounts.example.test/register",
  blocker: null,
  officialSources: ["https://developers.example.test/api-keys"],
};

describe("credential results", () => {
  it("creates a validated success only from an official allowed domain", () => {
    const result = createCredentialResult(plan, {
      credentialType: "api_key",
      credential: "secret-example-1234",
      sourceUrl: "https://developers.example.test/settings/keys",
      usageNote: "Send it as a bearer token.",
      validationStatus: "validated",
      validationNote: "An official read-only identity endpoint accepted it.",
    });

    expect(result).toEqual({
      status: "validated_success",
      appName: "Example Service",
      selectionReason: "It matches the requested capability.",
      credentialType: "api_key",
      credential: "secret-example-1234",
      sourceUrl: "https://developers.example.test/settings/keys",
      usageNote: "Send it as a bearer token.",
      validationNote: "An official read-only identity endpoint accepted it.",
    });
  });

  it("keeps an obtained credential explicitly unverified", () => {
    const result = createCredentialResult(plan, {
      credentialType: "api_key",
      credential: "secret-example-1234",
      sourceUrl: "https://developers.example.test/settings/keys",
      usageNote: "Use the documented Authorization header.",
      validationStatus: "not_validated",
      validationNote: "No harmless official check was available.",
    });

    expect(result.status).toBe("obtained_unverified");
    expect(result.validationNote).toContain("No harmless official check");
  });

  it("rejects credentials reported from outside researched official domains", () => {
    expect(() =>
      createCredentialResult(plan, {
        credentialType: "api_key",
        credential: "secret-example-1234",
        sourceUrl: "https://attacker.test/stolen-key",
        usageNote: "Unknown.",
        validationStatus: "not_validated",
        validationNote: "Unknown.",
      }),
    ).toThrow("Credential source is outside the researched official domains.");
  });

  it("masks and redacts credentials without preserving the secret", () => {
    const secret = "secret-example-1234";

    expect(maskCredential(secret)).toBe("••••1234");
    const redacted = redactSecrets(`Created ${secret}; do not log ${secret}.`, [
      secret,
    ]);
    expect(redacted).toBe("Created [REDACTED]; do not log [REDACTED].");
    expect(redacted).not.toContain(secret);
  });
});
