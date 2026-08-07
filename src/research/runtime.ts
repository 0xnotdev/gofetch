import { readServerEnv } from "@/config/env";
import type { CredentialPlan } from "@/domain/credential-plan";

import { BrowserbaseResearchProvider } from "./browserbase-research-provider";
import { buildCredentialPlan } from "./build-credential-plan";
import { GeminiPlanningModel } from "./gemini-planning-model";

export async function buildConfiguredCredentialPlan(query: string): Promise<CredentialPlan> {
  const env = readServerEnv();

  if (!env.BROWSERBASE_API_KEY || !env.GEMINI_API_KEY) {
    throw new Error("Research providers are not configured.");
  }

  return buildCredentialPlan(query, {
    research: new BrowserbaseResearchProvider({ apiKey: env.BROWSERBASE_API_KEY }),
    planner: new GeminiPlanningModel({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
    }),
  });
}
