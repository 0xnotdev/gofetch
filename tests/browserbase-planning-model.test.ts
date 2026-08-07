import { describe, expect, it, vi } from "vitest";

import { BrowserbasePlanningModel } from "../src/research/browserbase-planning-model";

describe("BrowserbasePlanningModel", () => {
  it("reuses one private Model Gateway session and closes it after classification", async () => {
    const extract = vi
      .fn()
      .mockResolvedValueOnce({
        inputMode: "direct",
        appName: "Example Service",
        selectionReason: "The user named it.",
        clarificationQuestion: null,
        officialSourceUrls: ["https://developers.example.test/api-keys"],
      })
      .mockResolvedValueOnce({
        path: "signup_required",
        credentialTypes: ["api_key"],
        summary: "Create an account and issue a key.",
        signupUrl: "https://accounts.example.test/register",
        blocker: null,
        publicCredential: null,
      });
    const init = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const constructors: unknown[] = [];
    class FakeStagehand {
      constructor(options: unknown) {
        constructors.push(options);
      }

      init = init;
      close = close;
      extract = extract;
    }
    const planner = new BrowserbasePlanningModel({
      apiKey: "browserbase-key",
      stagehandConstructor: FakeStagehand,
    });

    const target = await planner.resolveTarget({
      query: "Example Service",
      searchResults: [
        {
          title: "API keys",
          url: "https://developers.example.test/api-keys",
        },
      ],
    });
    const path = await planner.classifyPath({
      query: "Example Service",
      target,
      documents: [
        {
          url: "https://developers.example.test/api-keys",
          content: "Create an account, then create an API key.",
        },
      ],
    });

    expect(path.path).toBe("signup_required");
    expect(constructors).toHaveLength(1);
    expect(constructors[0]).toMatchObject({
      env: "BROWSERBASE",
      apiKey: "browserbase-key",
      model: "google/gemini-2.5-flash",
      keepAlive: false,
      browserbaseSessionCreateParams: {
        keepAlive: false,
        timeout: 120,
        browserSettings: {
          logSession: false,
          recordSession: false,
          solveCaptchas: false,
        },
      },
    });
    expect(init).toHaveBeenCalledOnce();
    expect(extract).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledWith({ force: true });
  });

  it("closes immediately when resolution needs clarification", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    class FakeStagehand {
      init = vi.fn().mockResolvedValue(undefined);
      close = close;
      extract = vi.fn().mockResolvedValue({
        inputMode: "ambiguous",
        appName: null,
        selectionReason: "Several unrelated apps share this name.",
        clarificationQuestion: "Which product or website do you mean?",
        officialSourceUrls: [],
      });
    }
    const planner = new BrowserbasePlanningModel({
      apiKey: "browserbase-key",
      stagehandConstructor: FakeStagehand,
    });

    await planner.resolveTarget({ query: "Compass", searchResults: [] });

    expect(close).toHaveBeenCalledWith({ force: true });
  });
});
