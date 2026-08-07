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
    execute.mockResolvedValueOnce({
      success: true,
      completed: true,
      message: "Credential obtained.",
      actions: [],
      output: {
        kind: "credential_obtained",
        summary: "Credential obtained without exposing its value.",
        credential: {
          credentialType: "api_key",
          credential: "secret-example-1234",
          sourceUrl: "https://accounts.example.test/settings/keys",
          usageNote: "Use the documented Authorization header.",
          validationStatus: "not_validated",
          validationNote: "No harmless official check was available.",
        },
      },
    });
    const credentialObservation = await session.execute(
      {
        appName: "Any Service",
        planSummary: "Find the API key.",
        credentialTypes: ["api_key"],
        officialSources: ["https://accounts.example.test/docs"],
      },
      signal,
    );
    await session.close();

    expect(receivedOptions).toMatchObject({
      env: "BROWSERBASE",
      apiKey: "browserbase-secret",
      keepAlive: false,
      waitForCaptchaSolves: false,
      logInferenceToFile: false,
      verbose: 0,
      experimental: true,
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
        excludeTools: ["search", "goto", "navback"],
        instruction: expect.stringContaining("Any Service"),
        output: expect.anything(),
        callbacks: {
          onStepFinish: expect.any(Function),
        },
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
    expect(credentialObservation).toMatchObject({
      kind: "credential_obtained",
      summary: "Credential obtained without exposing its value.",
      credential: {
        credential: "secret-example-1234",
        validationStatus: "not_validated",
      },
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

  it("enforces allowed navigation without a provider context policy hook", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://accounts.example.test/register"),
    };
    const stagehand = {
      browserbaseSessionID: "bb-session-current-context",
      browserbaseDebugURL:
        "https://www.browserbase.com/live/bb-session-current-context",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: {
        pages: vi.fn().mockReturnValue([page]),
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
    const signal = new AbortController().signal;

    const session = await factory.create(signal);
    await session.setAllowedDomains(["accounts.example.test"]);
    await expect(
      session.navigate("https://accounts.example.test/register", signal),
    ).resolves.toBeUndefined();
    await expect(
      session.navigate("https://evil.example.test/register", signal),
    ).rejects.toThrow("outside the verified domain policy");
  });
});
