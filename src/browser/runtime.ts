import { readServerEnv } from "../config/env";
import type { CredentialPlan } from "../domain/credential-plan";
import {
  BrowserRunCoordinator,
  type BrowserRunResult,
  type HumanHandback,
} from "./browser-run-coordinator";
import { BrowserbaseStagehandSessionFactory } from "./stagehand-browser-session";

let configuredCoordinator: BrowserRunCoordinator | undefined;

function getConfiguredCoordinator(): BrowserRunCoordinator {
  if (configuredCoordinator) {
    return configuredCoordinator;
  }

  const env = readServerEnv();
  if (!env.BROWSERBASE_API_KEY) {
    throw new Error("Browser execution providers are not configured.");
  }

  configuredCoordinator = new BrowserRunCoordinator({
    factory: new BrowserbaseStagehandSessionFactory({
      apiKey: env.BROWSERBASE_API_KEY,
      model: env.BROWSERBASE_BROWSER_MODEL,
    }),
    maxSessionStarts: 3,
    maxRunDurationMs: 12 * 60 * 1_000,
  });

  return configuredCoordinator;
}

export async function executeConfiguredBrowserPlan(
  plan: CredentialPlan,
): Promise<BrowserRunResult> {
  return getConfiguredCoordinator().run(plan);
}

export function cancelConfiguredBrowserRun(): boolean {
  return configuredCoordinator?.cancel() ?? false;
}

export async function resumeConfiguredBrowserRun(
  sessionId: string,
  handback: HumanHandback,
): Promise<BrowserRunResult> {
  if (!configuredCoordinator) {
    return {
      status: "technical_failure",
      reason: "No paused browser session is available.",
    };
  }
  return configuredCoordinator.resume(sessionId, handback);
}
