import { z } from "zod";

const serverEnvSchema = z.object({
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  BROWSERBASE_API_KEY: z.string().min(1).optional(),
  BROWSERBASE_BROWSER_MODEL: z
    .string()
    .min(1)
    .default("google/gemini-2.5-flash"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.1-flash-lite"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse(source);
}
