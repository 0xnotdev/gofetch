import { readServerEnv } from "@/config/env";
import type { CredentialPlan } from "@/domain/credential-plan";

import { BrowserbaseResearchProvider } from "./browserbase-research-provider";
import { BrowserbasePlanningModel } from "./browserbase-planning-model";
import { buildCredentialPlan } from "./build-credential-plan";
import { GeminiPlanningModel } from "./gemini-planning-model";

export async function buildConfiguredCredentialPlan(query: string): Promise<CredentialPlan> {
  const env = readServerEnv();
  const browserbaseApiKey = env.BROWSERBASE_API_KEY;

  if (!browserbaseApiKey) {
    throw new Error("Research providers are not configured.");
  }

  return runCredentialPlanWithRetry(() =>
    buildCredentialPlan(query, {
      research: new BrowserbaseResearchProvider({ apiKey: browserbaseApiKey }),
      planner: env.GEMINI_API_KEY
        ? new GeminiPlanningModel({
            apiKey: env.GEMINI_API_KEY,
            model: env.GEMINI_MODEL,
          })
        : new BrowserbasePlanningModel({
            apiKey: browserbaseApiKey,
            model: env.BROWSERBASE_BROWSER_MODEL,
          }),
    }),
  );
}

export async function runCredentialPlanWithRetry<T>(
  build: () => Promise<T>,
): Promise<T> {
  try {
    return await build();
  } catch {
    return build();
  }
}
