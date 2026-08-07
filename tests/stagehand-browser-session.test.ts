import { describe, expect, it, vi } from "vitest";

import {
  BrowserbaseStagehandSessionFactory,
  type StagehandAdapter,
  type StagehandAdapterConstructor,
  type StagehandAdapterOptions,
} from "../src/browser/stagehand-browser-session";

describe("BrowserbaseStagehandSessionFactory", () => {
  it("creates a short non-persistent Browserbase session and maps semantic output", async () => {
    let receivedOptions: StagehandAdapterOptions | undefined;
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://accounts.example.test/billing"),
    };
    const execute = vi.fn().mockResolvedValue({
      success: true,
      completed: true,
      message: "Payment is required.",
      actions: [],
      output: {
        kind: "payment_required",
        summary: "Payment is required.",
      },
    });
    const stagehand: StagehandAdapter = {
      browserbaseSessionID: "bb-session-1",
      browserbaseDebugURL: "https://www.browserbase.com/live/bb-session-1",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: {
        setDomainPolicy: vi.fn().mockResolvedValue(undefined),
        pages: vi.fn().mockReturnValue([page]),
      },
      agent: vi.fn().mockReturnValue({ execute }),
    };
    const StagehandFake = (class {
      constructor(options: StagehandAdapterOptions) {
        receivedOptions = options;
        return stagehand;
      }
    } as unknown) as StagehandAdapterConstructor;
    const factory = new BrowserbaseStagehandSessionFactory({
      apiKey: "browserbase-secret",
      stagehandConstructor: StagehandFake,
    });
    const signal = new AbortController().signal;

    const session = await factory.create(signal);
    expect(session.liveViewUrl).toBe(
      "https://www.browserbase.com/live/bb-session-1",
    );
    await session.setAllowedDomains(["accounts.example.test"]);
    await session.navigate("https://accounts.example.test/register", signal);
    const observation = await session.execute(
      {
        appName: "Any Service",
        planSummary: "Create an account and find the API key area.",
        credentialTypes: ["api_key"],
        officialSources: ["https://accounts.example.test/docs"],
      },
      signal,
      {
        value: "123456",
        description: "The user's private one-time code",
      },
    );
    await session.close();

    expect(receivedOptions).toMatchObject({
      env: "BROWSERBASE",
      apiKey: "browserbase-secret",
      keepAlive: false,
      waitForCaptchaSolves: false,
      logInferenceToFile: false,
      verbose: 0,
      browserbaseSessionCreateParams: {
        keepAlive: false,
        timeout: 720,
        browserSettings: {
          logSession: false,
          recordSession: false,
          solveCaptchas: false,
        },
      },
    });
    expect(receivedOptions).not.toHaveProperty("projectId");
    expect(receivedOptions?.browserbaseSessionCreateParams).not.toHaveProperty(
      "projectId",
    );
    expect(stagehand.context.setDomainPolicy).toHaveBeenCalledWith({
      allowedDomains: ["accounts.example.test"],
    });
    expect(page.goto).toHaveBeenCalledWith(
      "https://accounts.example.test/register",
      { waitUntil: "domcontentloaded", timeoutMs: 45_000 },
    );
    expect(stagehand.agent).toHaveBeenCalledWith({ mode: "dom" });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        maxSteps: 12,
        signal,
        useSearch: false,
        excludeTools: ["search"],
        instruction: expect.stringContaining("Any Service"),
        output: expect.anything(),
        variables: {
          humanInput: {
            value: "123456",
            description: "The user's private one-time code",
          },
        },
      }),
    );
    expect(observation).toEqual({
      kind: "payment_required",
      summary: "Payment is required.",
      currentUrl: "https://accounts.example.test/billing",
    });
    expect(stagehand.close).toHaveBeenCalledWith({ force: true });
  });

  it("force-closes a partially initialized session when creation fails", async () => {
    const stagehand = {
      browserbaseSessionID: undefined,
      init: vi.fn().mockRejectedValue(new Error("connection failed")),
      close: vi.fn().mockResolvedValue(undefined),
      context: {
        setDomainPolicy: vi.fn(),
        pages: vi.fn().mockReturnValue([]),
      },
      agent: vi.fn(),
    } as unknown as StagehandAdapter;
    const StagehandFake = (class {
      constructor() {
        return stagehand;
      }
    } as unknown) as StagehandAdapterConstructor;
    const factory = new BrowserbaseStagehandSessionFactory({
      apiKey: "browserbase-secret",
      stagehandConstructor: StagehandFake,
    });

    await expect(factory.create(new AbortController().signal)).rejects.toThrow(
      "connection failed",
    );
    expect(stagehand.close).toHaveBeenCalledWith({ force: true });
  });
});
