import type { CredentialType } from "./run";

export interface ResolvedTarget {
  inputMode: "direct" | "discovery" | "ambiguous";
  appName: string | null;
  selectionReason: string;
  clarificationQuestion: string | null;
  requiresConfirmation: boolean;
  officialSourceUrls: string[];
}

export type CredentialPath =
  | "public_credential"
  | "signup_required"
  | "blocked"
  | "insufficient_evidence";

export interface PathClassification {
  path: CredentialPath;
  credentialTypes: CredentialType[];
  summary: string;
  signupUrl: string | null;
  blocker: string | null;
}

export interface CredentialPlan extends Omit<ResolvedTarget, "officialSourceUrls">,
  PathClassification {
  officialSources: string[];
}
