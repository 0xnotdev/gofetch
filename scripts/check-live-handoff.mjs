import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Stagehand } from "@browserbasehq/stagehand";

const apiKey = process.env.BROWSERBASE_API_KEY;
if (!apiKey) {
  throw new Error("Configure BROWSERBASE_API_KEY in .env.local first.");
}

const expectedValue = "gofetch-human-check";
const signalPath = join(tmpdir(), "gofetch-live-handoff.ready");
rmSync(signalPath, { force: true });

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
    timeout: 300,
    browserSettings: {
      logSession: false,
      recordSession: false,
      solveCaptchas: false,
    },
    userMetadata: { application: "gofetch-live-handoff-check" },
  },
});

try {
  await stagehand.init();
  const sessionId = stagehand.browserbaseSessionID;
  const liveViewUrl = stagehand.browserbaseDebugURL;
  if (!sessionId || !liveViewUrl) {
    throw new Error("Browserbase did not return session and Live View metadata.");
  }

  await stagehand.context.setDomainPolicy({
    allowedDomains: ["www.selenium.dev"],
  });
  const page = stagehand.context.pages()[0];
  if (!page) throw new Error("The live session has no page.");
  await page.goto("https://www.selenium.dev/selenium/web/web-form.html", {
    waitUntil: "domcontentloaded",
    timeoutMs: 45_000,
  });

  console.log(`SESSION_ID=${sessionId}`);
  console.log(`LIVE_VIEW_URL=${liveViewUrl}`);
  console.log(`TYPE_VALUE=${expectedValue}`);
  console.log("WAITING_FOR_HUMAN=true");

  const deadline = Date.now() + 4 * 60 * 1_000;
  while (!existsSync(signalPath) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!existsSync(signalPath)) {
    throw new Error("Timed out waiting for human handback.");
  }

  const actualValue = await page.locator('input[name="my-text"]').inputValue();
  if (actualValue !== expectedValue) {
    throw new Error("The expected human-entered value was not found.");
  }
  await page.locator('button[type="submit"]').click();

  console.log(`RESUMED_SESSION_ID=${sessionId}`);
  console.log("SAME_SESSION_RESUME=true");
} finally {
  rmSync(signalPath, { force: true });
  await stagehand.close({ force: true });
}
