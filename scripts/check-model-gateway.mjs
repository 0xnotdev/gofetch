import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

const apiKey = process.env.BROWSERBASE_API_KEY;
const model = process.env.BROWSERBASE_BROWSER_MODEL ?? "google/gemini-2.5-flash";

if (!apiKey) {
  throw new Error("BROWSERBASE_API_KEY is required.");
}

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey,
  model,
  keepAlive: false,
  waitForCaptchaSolves: false,
  logInferenceToFile: false,
  verbose: 0,
  serverCache: true,
  browserbaseSessionCreateParams: {
    keepAlive: false,
    timeout: 60,
    browserSettings: {
      logSession: false,
      recordSession: false,
      solveCaptchas: false,
    },
    userMetadata: { application: "gofetch-model-gateway-check" },
  },
});

try {
  await stagehand.init();
  const result = await stagehand.extract(
    "Return the requested JSON object with ready set to true and provider set to Browserbase.",
    z.object({ ready: z.boolean(), provider: z.literal("Browserbase") }),
  );
  console.log(JSON.stringify({ model, result }));
} finally {
  await stagehand.close({ force: true }).catch(() => undefined);
}
