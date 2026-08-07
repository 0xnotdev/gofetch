import { z } from "zod";

import type { CredentialPlan } from "./credential-plan";

export const runRequestSchema = z.object({
  query: z.string().trim().min(1),
});

export type RunRequest = z.infer<typeof runRequestSchema>;

export type RunState =
  | "idle"
  | "resolving"
  | "awaiting_target_confirmation"
  | "researching"
  | "planning"
  | "browsing"
  | "awaiting_human"
  | "validating"
  | "validated_success"
  | "obtained_unverified"
  | "blocked"
  | "needs_clarification"
  | "technical_failure"
  | "cancelled"
  | "timed_out";

export interface RunSnapshot {
  id: string;
  query: string;
  state: RunState;
  createdAt: string;
}

export interface PlannedRunSnapshot extends RunSnapshot {
  plan?: CredentialPlan;
  targetConfirmedAt?: string;
}

export interface ProgressEvent {
  sequence: number;
  state: RunState;
  message: string;
  occurredAt: string;
}

export type HumanInterventionKind =
  | "identity_value"
  | "otp"
  | "magic_link"
  | "captcha"
  | "browser_takeover";

export interface HumanInterventionRequest {
  id: string;
  kind: HumanInterventionKind;
  prompt: string;
  reason: string;
  sensitive: boolean;
}

export type CredentialType =
  | "api_key"
  | "personal_access_token"
  | "bearer_token"
  | "oauth_client"
  | "public_demo_key";

export interface SuccessResult {
  status: "validated_success" | "obtained_unverified";
  appName: string;
  selectionReason?: string;
  credentialType: CredentialType;
  credential: string;
  sourceUrl: string;
  usageNote: string;
  validationNote: string;
}

export type FailureStatus =
  | "blocked"
  | "needs_clarification"
  | "technical_failure"
  | "cancelled"
  | "timed_out";

export interface FailureResult {
  status: FailureStatus;
  reason: string;
  stage: RunState;
  evidence: string[];
  nextAction?: string;
}

export type RunResult = SuccessResult | FailureResult;
