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
    const extract = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "act",
        summary: "Continue through the account flow.",
        action: "Click the Continue button.",
      })
      .mockResolvedValueOnce({
        kind: "payment_required",
        summary: "Payment is required.",
      })
      .mockResolvedValueOnce({
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
      });
    const act = vi.fn().mockResolvedValue({
      success: true,
      message: "Clicked Continue.",
      actionDescription: "Click the Continue button.",
      actions: [],
    });
    const agent = vi.fn(() => {
      throw new Error("The hosted primitive loop must not use experimental agent features.");
    });
    const stagehand = ({
      browserbaseSessionID: "bb-session-1",
      browserbaseDebugURL: "https://www.browserbase.com/live/bb-session-1",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: {
        pages: vi.fn().mockReturnValue([page]),
      },
      extract,
      act,
      agent,
    } as unknown) as StagehandAdapter;
    const StagehandFake = (class {
      constructor(options: StagehandAdapterOptions) {
        receivedOptions = options;
        return stagehand;
      }
    } as unknown) as StagehandAdapterConstructor;
    const factory = new BrowserbaseStagehandSessionFactory({
      apiKey: "browserbase-secret",
      model: "google/gemini-2.5-flash",
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
    );
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
      experimental: false,
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
    expect(agent).not.toHaveBeenCalled();
    expect(extract).toHaveBeenCalledWith(
      expect.stringContaining("Any Service"),
      expect.anything(),
    );
    expect(act).toHaveBeenCalledWith("Click the Continue button.");
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

  it("keeps a private handback value out of the model instruction", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://accounts.example.test/verify"),
    };
    const act = vi.fn().mockResolvedValue({
      success: true,
      message: "Entered the one-time code.",
    });
    const stagehand = ({
      browserbaseSessionID: "bb-private-input",
      browserbaseDebugURL: "https://www.browserbase.com/live/bb-private-input",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: { pages: vi.fn().mockReturnValue([page]) },
      act,
      extract: vi.fn().mockResolvedValue({
        kind: "human_required",
        summary: "Confirm the account in the browser.",
        intervention: {
          kind: "browser_takeover",
          prompt: "Confirm the account.",
          reason: "The confirmation requires human review.",
          sensitive: true,
        },
      }),
    } as unknown) as StagehandAdapter;
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

    await session.execute(
      {
        appName: "Any Service",
        planSummary: "Finish account verification.",
        credentialTypes: ["api_key"],
        officialSources: ["https://accounts.example.test/docs"],
      },
      signal,
      { value: "654321", description: "The one-time verification code" },
    );

    expect(act).toHaveBeenNthCalledWith(
      1,
      expect.not.stringContaining("654321"),
      {
        variables: {
          humanInput: {
            value: "654321",
            description: "The one-time verification code",
          },
        },
      },
    );
  });

  it("stops immediately when a semantic action leaves the verified domains", async () => {
    let currentUrl = "https://accounts.example.test/register";
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => currentUrl),
    };
    const stagehand = ({
      browserbaseSessionID: "bb-domain-escape",
      browserbaseDebugURL: "https://www.browserbase.com/live/bb-domain-escape",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: { pages: vi.fn().mockReturnValue([page]) },
      extract: vi.fn().mockResolvedValue({
        kind: "act",
        summary: "Continue.",
        action: "Click Continue.",
      }),
      act: vi.fn().mockImplementation(async () => {
        currentUrl = "https://evil.example.test/phishing";
        return { success: true, message: "Clicked." };
      }),
    } as unknown) as StagehandAdapter;
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
      session.execute(
        {
          appName: "Any Service",
          planSummary: "Find a credential.",
          credentialTypes: ["api_key"],
          officialSources: ["https://accounts.example.test/docs"],
        },
        signal,
      ),
    ).rejects.toThrow("outside the verified domain policy");
  });

  it("treats a loading page as a retryable step instead of a target blocker", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://accounts.example.test/register"),
    };
    const extract = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "blocked",
        summary: "The page is still loading, unable to proceed.",
      })
      .mockResolvedValueOnce({
        kind: "human_required",
        summary: "Identity details are required.",
        intervention: {
          kind: "identity_value",
          prompt: "Enter your identity details in the live browser.",
          reason: "Only the account owner can provide them.",
          sensitive: true,
        },
      });
    const act = vi.fn().mockResolvedValue({
      success: true,
      message: "Waited for the page.",
    });
    const stagehand = ({
      browserbaseSessionID: "bb-loading",
      browserbaseDebugURL: "https://www.browserbase.com/live/bb-loading",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: { pages: vi.fn().mockReturnValue([page]) },
      extract,
      act,
    } as unknown) as StagehandAdapter;
    const StagehandFake = (class {
      constructor() {
        return stagehand;
      }
    } as unknown) as StagehandAdapterConstructor;
    const factory = new BrowserbaseStagehandSessionFactory({
      apiKey: "browserbase-secret",
      stagehandConstructor: StagehandFake,
    });
    const session = await factory.create(new AbortController().signal);
    await session.setAllowedDomains(["accounts.example.test"]);

    await expect(
      session.execute(
        {
          appName: "Any Service",
          planSummary: "Create an account.",
          credentialTypes: ["api_key"],
          officialSources: ["https://accounts.example.test/docs"],
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ kind: "human_required" });
    expect(act).toHaveBeenCalledWith("Wait for the current page to finish loading.");
  });
});
