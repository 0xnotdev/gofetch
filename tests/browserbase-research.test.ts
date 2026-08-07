import { describe, expect, it } from "vitest";

import { BrowserbaseResearchProvider } from "../src/research/browserbase-research-provider";

describe("BrowserbaseResearchProvider", () => {
  it("returns normalized web-search results", async () => {
    const requests: Array<{ url: string; apiKey: string | null }> = [];
    const provider = new BrowserbaseResearchProvider({
      apiKey: "bb_test_key",
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        requests.push({
          url: String(input),
          apiKey: headers.get("x-bb-api-key"),
        });
        return Response.json({
          requestId: "search-1",
          query: "Atlas Notes official API",
          results: [
            {
              id: "result-1",
              title: "Atlas Notes developer docs",
              url: "https://developers.atlas.test/api",
            },
          ],
        });
      },
    });

    await expect(provider.search("Atlas Notes official API")).resolves.toEqual([
      {
        title: "Atlas Notes developer docs",
        url: "https://developers.atlas.test/api",
      },
    ]);
    expect(requests).toEqual([
      {
        url: "https://api.browserbase.com/v1/search",
        apiKey: "bb_test_key",
      },
    ]);
  });

  it("fetches an official source without following redirects", async () => {
    let requestBody: unknown;
    const provider = new BrowserbaseResearchProvider({
      apiKey: "bb_test_key",
      fetch: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          id: "fetch-1",
          statusCode: 200,
          headers: {},
          content: "Generate an API key from the developer dashboard.",
          contentType: "text/html",
          encoding: "utf-8",
        });
      },
    });

    await expect(
      provider.fetch("https://developers.atlas.test/api-keys"),
    ).resolves.toEqual({
      url: "https://developers.atlas.test/api-keys",
      content: "Generate an API key from the developer dashboard.",
    });
    expect(requestBody).toEqual({
      url: "https://developers.atlas.test/api-keys",
      allowRedirects: false,
      allowInsecureSsl: false,
      proxies: false,
    });
  });
});
