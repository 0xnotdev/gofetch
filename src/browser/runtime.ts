import { readServerEnv } from "../config/env";
import type { CredentialPlan } from "../domain/credential-plan";
import {
  BrowserRunCoordinator,
  type BrowserRunResult,
} from "./browser-run-coordinator";
import { BrowserbaseStagehandSessionFactory } from "./stagehand-browser-session";

let configuredCoordinator: BrowserRunCoordinator | undefined;

function getConfiguredCoordinator(): BrowserRunCoordinator {
  if (configuredCoordinator) {
    return configuredCoordinator;
  }

  const env = readServerEnv();
  if (!env.BROWSERBASE_API_KEY || !env.BROWSERBASE_PROJECT_ID) {
    throw new Error("Browser execution providers are not configured.");
  }

  configuredCoordinator = new BrowserRunCoordinator({
    factory: new BrowserbaseStagehandSessionFactory({
      apiKey: env.BROWSERBASE_API_KEY,
      projectId: env.BROWSERBASE_PROJECT_ID,
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
