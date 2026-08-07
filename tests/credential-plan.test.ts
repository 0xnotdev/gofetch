import { describe, expect, it } from "vitest";

import { buildCredentialPlan } from "../src/research/build-credential-plan";

describe("buildCredentialPlan", () => {
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
});
