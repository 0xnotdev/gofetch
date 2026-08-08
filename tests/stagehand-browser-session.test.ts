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
      { timeout: 45_000 },
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
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
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
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
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
    expect(page.waitForTimeout).toHaveBeenCalledWith(1_500);
    expect(act).not.toHaveBeenCalled();
  });

  it("continues through official navigation when human action is claimed on a documentation page", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://docs.example.test/api-keys"),
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
    };
    const extract = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "human_required",
        summary: "Sign up requires an email address.",
        intervention: {
          kind: "identity_value",
          prompt: "Enter your email address.",
          reason: "An account needs identity details.",
          sensitive: true,
        },
      })
      .mockResolvedValueOnce({
        kind: "human_required",
        summary: "The visible signup form needs your email address.",
        intervention: {
          kind: "identity_value",
          prompt: "Enter your email address in the signup form.",
          reason: "Only the account owner can provide it.",
          sensitive: true,
        },
      });
    const act = vi.fn().mockResolvedValue({
      success: true,
      message: "Opened the account page.",
    });
    const stagehand = ({
      browserbaseSessionID: "bb-documentation-human-claim",
      browserbaseDebugURL:
        "https://www.browserbase.com/live/bb-documentation-human-claim",
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
    await session.setAllowedDomains(["docs.example.test"]);

    await expect(
      session.execute(
        {
          appName: "Any Service",
          planSummary: "Create an account and retrieve an API key.",
          credentialTypes: ["api_key"],
          officialSources: ["https://docs.example.test/api-keys"],
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      kind: "human_required",
      summary: "The visible signup form needs your email address.",
    });

    expect(act).toHaveBeenCalledWith(
      expect.stringContaining("There is no visible human-only input"),
    );
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("hands a visible third-party identity form to the user instead of blocking", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://accounts.identity.example.test/login"),
      evaluate: vi.fn().mockResolvedValue(true),
    };
    const stagehand = ({
      browserbaseSessionID: "bb-external-login",
      browserbaseDebugURL: "https://www.browserbase.com/live/bb-external-login",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: { pages: vi.fn().mockReturnValue([page]) },
      extract: vi.fn().mockResolvedValue({
        kind: "blocked",
        summary:
          "Cannot proceed without signing up because the current page requires entering personal information.",
      }),
      act: vi.fn(),
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
    await session.setAllowedDomains(["accounts.identity.example.test"]);

    await expect(
      session.execute(
        {
          appName: "Any Service",
          planSummary: "Sign in and create an API key.",
          credentialTypes: ["api_key"],
          officialSources: ["https://accounts.identity.example.test/login"],
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      kind: "human_required",
      intervention: {
        kind: "browser_takeover",
        sensitive: true,
      },
    });
  });

  it("accepts the immediate HTTPS redirect from a verified signup URL", async () => {
    let currentUrl = "about:blank";
    const page = {
      goto: vi.fn().mockImplementation(async () => {
        currentUrl = "https://login.example.test/register";
      }),
      url: vi.fn(() => currentUrl),
    };
    const stagehand = ({
      browserbaseSessionID: "bb-signup-redirect",
      browserbaseDebugURL: "https://www.browserbase.com/live/bb-signup-redirect",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: { pages: vi.fn().mockReturnValue([page]) },
      extract: vi.fn(),
      act: vi.fn(),
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
    await session.setAllowedDomains(["www.example.test"]);

    await expect(
      session.navigate("https://www.example.test/start-free", signal),
    ).resolves.toBeUndefined();
  });

  it("hands an external identity-provider page to the human without automating it", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://accounts.google.com/signin"),
    };
    const extract = vi.fn();
    const stagehand = ({
      browserbaseSessionID: "bb-external-identity",
      browserbaseDebugURL:
        "https://www.browserbase.com/live/bb-external-identity",
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: { pages: vi.fn().mockReturnValue([page]) },
      extract,
      act: vi.fn(),
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
    await session.setAllowedDomains(["composio.dev"]);

    await expect(
      session.execute(
        {
          appName: "Composio",
          planSummary: "Sign in and retrieve an API key.",
          credentialTypes: ["api_key"],
          officialSources: ["https://composio.dev/auth"],
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      kind: "human_required",
      intervention: { kind: "browser_takeover" },
      currentUrl: "https://accounts.google.com/signin",
    });
    expect(extract).not.toHaveBeenCalled();
  });
});
