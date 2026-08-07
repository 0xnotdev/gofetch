import { z } from "zod";

import type { SearchResult, SourceDocument } from "./build-credential-plan";

const searchResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.url(),
    }),
  ),
});

const fetchResponseSchema = z.object({
  statusCode: z.number().int(),
  content: z.string(),
});

type FetchLike = typeof globalThis.fetch;

export class BrowserbaseResearchProvider {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;

  constructor(options: { apiKey: string; fetch?: FetchLike }) {
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async search(query: string): Promise<SearchResult[]> {
    const response = await this.#fetch("https://api.browserbase.com/v1/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bb-api-key": this.#apiKey,
      },
      body: JSON.stringify({ query, numResults: 10 }),
    });

    if (!response.ok) {
      throw new Error(`Browserbase Search failed with HTTP ${response.status}.`);
    }

    return searchResponseSchema.parse(await response.json()).results;
  }

  async fetch(url: string): Promise<SourceDocument> {
    const response = await this.#fetch("https://api.browserbase.com/v1/fetch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bb-api-key": this.#apiKey,
      },
      body: JSON.stringify({
        url,
        allowRedirects: false,
        allowInsecureSsl: false,
        proxies: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Browserbase Fetch failed with HTTP ${response.status}.`);
    }

    const result = fetchResponseSchema.parse(await response.json());

    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`Official source returned HTTP ${result.statusCode}.`);
    }

    return { url, content: result.content.slice(0, 30_000) };
  }
}
