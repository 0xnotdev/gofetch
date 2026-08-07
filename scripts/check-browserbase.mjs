import { Stagehand } from "@browserbasehq/stagehand";

const apiKey = process.env.BROWSERBASE_API_KEY;

if (!apiKey) {
  console.error(
    "Browserbase connectivity check skipped: configure BROWSERBASE_API_KEY in .env.local.",
  );
  process.exitCode = 2;
} else {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey,
    model:
      process.env.BROWSERBASE_BROWSER_MODEL ?? "google/gemini-3.5-flash",
    keepAlive: false,
    waitForCaptchaSolves: false,
    logInferenceToFile: false,
    verbose: 0,
    browserbaseSessionCreateParams: {
      keepAlive: false,
      timeout: 60,
      browserSettings: {
        logSession: false,
        recordSession: false,
        solveCaptchas: false,
      },
      userMetadata: { application: "gofetch-connectivity-check" },
    },
  });

  try {
    await stagehand.init();
    if (!stagehand.browserbaseSessionID) {
      throw new Error("Browserbase did not return a session ID.");
    }
    console.log("Browserbase connectivity check passed; session was created.");
  } finally {
    await stagehand.close({ force: true });
  }
}
