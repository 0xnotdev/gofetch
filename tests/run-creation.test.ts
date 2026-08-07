import { describe, expect, it } from "vitest";

import { POST } from "../src/app/api/runs/route";

describe("POST /api/runs", () => {
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
});
