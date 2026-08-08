import { getDomain } from "tldts";

import type { CredentialPlan } from "../domain/credential-plan";
import type { CredentialType, SuccessResult } from "../domain/run";

export interface CredentialEvidence {
  credentialType: CredentialType;
  credential: string;
  sourceUrl: string;
  usageNote: string;
  validationStatus: "validated" | "not_validated";
  validationNote: string;
}

export function createCredentialResult(
  plan: CredentialPlan,
  evidence: CredentialEvidence,
): SuccessResult {
  if (!plan.appName) {
    throw new Error("A credential result requires a resolved app.");
  }
  if (!plan.credentialTypes.includes(evidence.credentialType)) {
    throw new Error("Credential type does not match the researched plan.");
  }
  if (!evidence.credential.trim()) {
    throw new Error("The extracted credential is empty.");
  }

  const source = new URL(evidence.sourceUrl);
  const officialHosts = new Set(
    [...plan.officialSources, plan.signupUrl]
      .filter((value): value is string => Boolean(value))
      .map((value) => new URL(value).hostname),
  );
  const officialSiteRoots = new Set(
    [...officialHosts].flatMap((hostname) => {
      const root = getDomain(hostname, { allowPrivateDomains: true });
      return root ? [root] : [];
    }),
  );
  const sourceRoot = getDomain(source.hostname, { allowPrivateDomains: true });
  if (
    source.protocol !== "https:" ||
    source.username ||
    source.password ||
    (!officialHosts.has(source.hostname) &&
      (!sourceRoot || !officialSiteRoots.has(sourceRoot)))
  ) {
    throw new Error(
      "Credential source is outside the researched official domains.",
    );
  }

  return {
    status:
      evidence.validationStatus === "validated"
        ? "validated_success"
        : "obtained_unverified",
    appName: plan.appName,
    ...(plan.inputMode === "discovery"
      ? { selectionReason: plan.selectionReason }
      : {}),
    credentialType: evidence.credentialType,
    credential: evidence.credential,
    sourceUrl: evidence.sourceUrl,
    usageNote: evidence.usageNote,
    validationNote: evidence.validationNote,
  };
}

export function maskCredential(credential: string): string {
  return `••••${credential.slice(-4)}`;
}

export function redactSecrets(text: string, secrets: string[]): string {
  return [...new Set(secrets)]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .reduce(
      (redacted, secret) => redacted.replaceAll(secret, "[REDACTED]"),
      text,
    );
}
