import { describe, expect, it, vi } from "vitest";

import { buildCredentialPlan } from "../src/research/build-credential-plan";

describe("buildCredentialPlan", () => {
  it("captures an officially documented public demo credential without a browser", async () => {
    const search = vi.fn(async () => [
      {
        title: "Example API authentication",
        url: "https://developers.example.test/demo-key",
      },
    ]);
    const plan = await buildCredentialPlan("Example public API", {
      research: {
        search,
        async fetch(url) {
          return {
            url,
            content: "Use the public demo key DEMO-123 for read-only examples.",
          };
        },
      },
      planner: {
        async resolveTarget() {
          return {
            inputMode: "direct" as const,
            appName: "Example API",
            selectionReason: "The user named it.",
            clarificationQuestion: null,
            requiresConfirmation: false,
            officialSourceUrls: [
              "https://developers.example.test/demo-key",
            ],
          };
        },
        async classifyPath() {
          return {
            path: "public_credential" as const,
            credentialTypes: ["public_demo_key" as const],
            summary: "The official docs publish a read-only demo key.",
            signupUrl: null,
            blocker: null,
            publicCredential: {
              credentialType: "public_demo_key" as const,
              credential: "DEMO-123",
              sourceUrl: "https://developers.example.test/demo-key",
              usageNote: "Use only for documented read-only examples.",
              limitations: "Not intended for production data.",
            },
          };
        },
      },
    });

    expect(plan).toMatchObject({
      path: "public_credential",
      publicCredential: {
        credential: "DEMO-123",
        credentialType: "public_demo_key",
      },
    });
    expect(search).toHaveBeenCalledWith(
      expect.stringContaining("signup login dashboard"),
    );
  });

  it("builds an evidence-backed signup plan for a directly named app", async () => {
    const plan = await buildCredentialPlan("Lantern CRM", {
      research: {
        async search() {
          return [
            {
              title: "Lantern developer documentation",
              url: "https://developers.lantern.test/authentication",
            },
            {
              title: "A third-party Lantern review",
              url: "https://reviews.test/lantern",
            },
          ];
        },
        async fetch(url) {
          return {
            url,
            content: "Create an account, then generate an API key from Developer settings.",
          };
        },
      },
      planner: {
        async resolveTarget() {
          return {
            inputMode: "direct" as const,
            appName: "Lantern CRM",
            selectionReason: "The user directly named Lantern CRM.",
            clarificationQuestion: null,
            requiresConfirmation: false,
            officialSourceUrls: ["https://developers.lantern.test/authentication"],
          };
        },
        async classifyPath() {
          return {
            path: "signup_required" as const,
            credentialTypes: ["api_key" as const],
            summary: "Create an account and generate an API key in Developer settings.",
            signupUrl: "https://lantern.test/signup",
            blocker: null,
          };
        },
      },
    });

    expect(plan).toEqual({
      inputMode: "direct",
      appName: "Lantern CRM",
      selectionReason: "The user directly named Lantern CRM.",
      clarificationQuestion: null,
      requiresConfirmation: false,
      path: "signup_required",
      credentialTypes: ["api_key"],
      summary: "Create an account and generate an API key in Developer settings.",
      signupUrl: "https://lantern.test/signup",
      blocker: null,
      officialSources: ["https://developers.lantern.test/authentication"],
    });
  });

  it("adds a related official account route when the resolver selected only documentation", async () => {
    const documentationUrl = "https://docs.example.test/api/authentication";
    const accountUrl = "https://www.example.test/auth";
    const fetch = vi.fn(async (url: string) => ({
      url,
      content:
        url === accountUrl
          ? "<a href=\"/signup\">Sign up</a>"
          : "API authentication uses account-scoped API keys.",
    }));

    const plan = await buildCredentialPlan("Example Platform", {
      research: {
        async search() {
          return [
            { title: "Example API docs", url: documentationUrl },
            { title: "Example account login", url: accountUrl },
          ];
        },
        fetch,
      },
      planner: {
        async resolveTarget() {
          return {
            inputMode: "direct",
            appName: "Example Platform",
            selectionReason: "The user named it.",
            clarificationQuestion: null,
            requiresConfirmation: false,
            officialSourceUrls: [documentationUrl],
          };
        },
        async classifyPath({ documents }) {
          expect(documents.map((document) => document.url)).toContain(accountUrl);
          return {
            path: "signup_required",
            credentialTypes: ["api_key"],
            summary: "Create an account and generate an API key.",
            signupUrl: accountUrl,
            blocker: null,
          };
        },
      },
    });

    expect(fetch).toHaveBeenCalledWith(accountUrl);
    expect(plan.signupUrl).toBe(accountUrl);
  });

  it("requires confirmation before acting on an app selected from requirements", async () => {
    const plan = await buildCredentialPlan("an email delivery app with a free API", {
      research: {
        async search() {
          return [
            {
              title: "Fable Mail API",
              url: "https://docs.fable-mail.test/api-keys",
            },
          ];
        },
        async fetch(url) {
          return {
            url,
            content: "Fable Mail offers a free API key after account creation.",
          };
        },
      },
      planner: {
        async resolveTarget() {
          return {
            inputMode: "discovery" as const,
            appName: "Fable Mail",
            selectionReason: "It matches the requested email capability and offers a free API.",
            clarificationQuestion: null,
            requiresConfirmation: false,
            officialSourceUrls: ["https://docs.fable-mail.test/api-keys"],
          };
        },
        async classifyPath() {
          return {
            path: "signup_required" as const,
            credentialTypes: ["api_key" as const],
            summary: "Create a free account and issue an API key.",
            signupUrl: "https://fable-mail.test/signup",
            blocker: null,
          };
        },
      },
    });

    expect(plan).toMatchObject({
      inputMode: "discovery",
      appName: "Fable Mail",
      requiresConfirmation: true,
      path: "signup_required",
    });
  });

  it("refuses to plan actions from a source that was not found in research", async () => {
    let fetched = false;
    let classified = false;

    const plan = await buildCredentialPlan("Harbor Analytics", {
      research: {
        async search() {
          return [
            {
              title: "Harbor Analytics overview",
              url: "https://harbor.test/product",
            },
          ];
        },
        async fetch() {
          fetched = true;
          throw new Error("An unverified source must not be fetched.");
        },
      },
      planner: {
        async resolveTarget() {
          return {
            inputMode: "direct" as const,
            appName: "Harbor Analytics",
            selectionReason: "The user directly named Harbor Analytics.",
            clarificationQuestion: null,
            requiresConfirmation: false,
            officialSourceUrls: ["https://malicious.test/fake-harbor-docs"],
          };
        },
        async classifyPath() {
          classified = true;
          throw new Error("Unverified content must not reach classification.");
        },
      },
    });

    expect(fetched).toBe(false);
    expect(classified).toBe(false);
    expect(plan).toMatchObject({
      appName: "Harbor Analytics",
      path: "insufficient_evidence",
      officialSources: [],
      signupUrl: null,
    });
  });

  it("returns one focused clarification question for ambiguous requirements", async () => {
    let classified = false;
    const plan = await buildCredentialPlan("something useful for my team", {
      research: {
        async search() {
          return [];
        },
        async fetch() {
          throw new Error("Ambiguous input must not fetch a target site.");
        },
      },
      planner: {
        async resolveTarget() {
          return {
            inputMode: "ambiguous" as const,
            appName: null,
            selectionReason: "The requirements do not identify a capability category.",
            clarificationQuestion: "What main task should the app help you accomplish?",
            requiresConfirmation: false,
            officialSourceUrls: [],
          };
        },
        async classifyPath() {
          classified = true;
          throw new Error("Ambiguous input must not be classified.");
        },
      },
    });

    expect(classified).toBe(false);
    expect(plan).toMatchObject({
      inputMode: "ambiguous",
      appName: null,
      path: "insufficient_evidence",
      clarificationQuestion: "What main task should the app help you accomplish?",
    });
  });

  it("returns insufficient evidence and disposes planning infrastructure when all fetches fail", async () => {
    const dispose = vi.fn().mockResolvedValue(undefined);

    const plan = await buildCredentialPlan("Northstar Tasks", {
        research: {
          async search() {
            return [
              {
                title: "Northstar API",
                url: "https://developers.northstar.test/api",
              },
            ];
          },
          async fetch() {
            throw new Error("Official source was unavailable.");
          },
        },
        planner: {
          async resolveTarget() {
            return {
              inputMode: "direct" as const,
              appName: "Northstar Tasks",
              selectionReason: "The user named it.",
              clarificationQuestion: null,
              requiresConfirmation: false,
              officialSourceUrls: ["https://developers.northstar.test/api"],
            };
          },
          async classifyPath() {
            throw new Error("Classification must not run after fetch failure.");
          },
          dispose,
        },
      });

    expect(plan).toMatchObject({
      path: "insufficient_evidence",
      blocker: "No official source returned usable credential-path evidence.",
    });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("classifies from successful official sources when another source cannot be fetched", async () => {
    let classifiedDocuments: Array<{ url: string; content: string }> = [];
    const successfulUrl = "https://developers.northstar.test/auth";
    const plan = await buildCredentialPlan("Northstar Tasks", {
      research: {
        async search() {
          return [
            { title: "Northstar root", url: "https://developers.northstar.test/" },
            { title: "Northstar auth", url: successfulUrl },
          ];
        },
        async fetch(url) {
          if (url !== successfulUrl) throw new Error("Redirected source rejected.");
          return { url, content: "Create a free account and issue an API key." };
        },
      },
      planner: {
        async resolveTarget() {
          return {
            inputMode: "discovery" as const,
            appName: "Northstar Tasks",
            selectionReason: "It is the strongest evidence-backed match.",
            clarificationQuestion: null,
            requiresConfirmation: true,
            officialSourceUrls: [
              "https://developers.northstar.test/",
              successfulUrl,
            ],
          };
        },
        async classifyPath({ documents }) {
          classifiedDocuments = documents;
          return {
            path: "signup_required" as const,
            credentialTypes: ["api_key" as const],
            summary: "Create an account and issue a key.",
            signupUrl: "https://northstar.test/signup",
            blocker: null,
          };
        },
      },
    });

    expect(classifiedDocuments).toEqual([
      { url: successfulUrl, content: "Create a free account and issue an API key." },
    ]);
    expect(plan).toMatchObject({
      inputMode: "discovery",
      path: "signup_required",
      officialSources: [successfulUrl],
    });
  });
});
