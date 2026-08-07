import { Stagehand } from "@browserbasehq/stagehand";

const apiKey = process.env.BROWSERBASE_API_KEY;
const projectId = process.env.BROWSERBASE_PROJECT_ID;

if (!apiKey || !projectId) {
  console.error(
    "Browserbase connectivity check skipped: configure BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID in .env.local.",
  );
  process.exitCode = 2;
} else {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey,
    projectId,
    model:
      process.env.BROWSERBASE_BROWSER_MODEL ?? "google/gemini-3.5-flash",
    keepAlive: false,
    waitForCaptchaSolves: false,
    logInferenceToFile: false,
    verbose: 0,
    browserbaseSessionCreateParams: {
      projectId,
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
