import { describe, expect, it } from "vitest";

import { createPostRunsHandler } from "../src/app/api/runs/route";

describe("POST /api/runs", () => {
  const POST = createPostRunsHandler();

  it("creates a run for arbitrary app requirements", async () => {
    const response = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "a privacy-friendly project management app with a free API",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      query: "a privacy-friendly project management app with a free API",
      state: "resolving",
    });
  });

  it("rejects input that does not identify an app or app requirements", async () => {
    const response = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "   " }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Enter an app name or describe the kind of app you need.",
      },
    });
  });

  it("rejects malformed request bodies without starting a run", async () => {
    const response = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request" },
    });
  });

  it("returns a researched plan and pauses before acting on a discovered app", async () => {
    const handler = createPostRunsHandler({
      buildPlan: async () => ({
        inputMode: "discovery",
        appName: "Fable Mail",
        selectionReason: "It matches the requested capability and has a free API.",
        clarificationQuestion: null,
        requiresConfirmation: true,
        path: "signup_required",
        credentialTypes: ["api_key"],
        summary: "Create a free account and generate an API key.",
        signupUrl: "https://fable-mail.test/signup",
        blocker: null,
        officialSources: ["https://docs.fable-mail.test/api-keys"],
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "an email delivery app with a free API" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      query: "an email delivery app with a free API",
      state: "awaiting_target_confirmation",
      plan: {
        appName: "Fable Mail",
        inputMode: "discovery",
        path: "signup_required",
      },
    });
  });

  it("returns an official public demo credential without opening a browser", async () => {
    const handler = createPostRunsHandler({
      buildPlan: async () => ({
        inputMode: "direct",
        appName: "Example API",
        selectionReason: "The user named it.",
        clarificationQuestion: null,
        requiresConfirmation: false,
        path: "public_credential",
        credentialTypes: ["public_demo_key"],
        summary: "The official docs publish a demo key.",
        signupUrl: null,
        blocker: null,
        officialSources: ["https://developers.example.test/demo-key"],
        publicCredential: {
          credentialType: "public_demo_key",
          credential: "DEMO-123",
          sourceUrl: "https://developers.example.test/demo-key",
          usageNote: "Use only for documented examples.",
          limitations: "Not intended for production data.",
        },
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "Example API" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      state: "obtained_unverified",
      result: {
        status: "obtained_unverified",
        credentialType: "public_demo_key",
        credential: "DEMO-123",
      },
    });
  });

  it("reports research infrastructure failures without leaking provider details", async () => {
    const handler = createPostRunsHandler({
      buildPlan: async () => {
        throw new Error("secret provider payload");
      },
    });

    const response = await handler(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "Northstar Tasks" }),
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "research_failed",
        message: "GoFetch could not complete official-source research for this run.",
      },
    });
  });
});
