import { z } from "zod";

const serverEnvSchema = z.object({
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  BROWSERBASE_API_KEY: z.string().min(1).optional(),
  BROWSERBASE_PROJECT_ID: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse(source);
}
