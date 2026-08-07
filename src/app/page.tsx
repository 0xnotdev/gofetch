"use client";

import { FormEvent, useState } from "react";

import type { RunSnapshot } from "@/domain/run";

const EXAMPLE_QUERY = "A project-management app with a free API";

export default function Home() {
  const [query, setQuery] = useState("");
  const [run, setRun] = useState<RunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  async function startRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRun(null);
    setIsStarting(true);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = (await response.json()) as RunSnapshot | {
        error: { message: string };
      };

      if (!response.ok) {
        setError("error" in body ? body.error.message : "The run could not be started.");
        return;
      }

      setRun(body as RunSnapshot);
    } catch {
      setError("GoFetch could not reach its server. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Shared browser agent</p>
        <h1 id="page-title">GoFetch</h1>
        <p className="lede">
          Name an app—or describe what you need. GoFetch will find the official API path and
          work toward a usable credential.
        </p>

        <form className="run-form" onSubmit={startRun}>
          <label htmlFor="app-query">What app or capability are you looking for?</label>
          <div className="input-row">
            <input
              id="app-query"
              name="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={EXAMPLE_QUERY}
              autoComplete="off"
              disabled={isStarting}
            />
            <button type="submit" disabled={isStarting}>
              {isStarting ? "Starting…" : "Start run"}
            </button>
          </div>
        </form>

        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}

        {run ? (
          <section className="notice run-status" aria-live="polite">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <p className="status-label">Run created</p>
              <p>{run.query}</p>
              <p className="status-meta">State: {run.state}</p>
            </div>
          </section>
        ) : null}
      </section>

      <aside className="expectations" aria-label="How GoFetch works">
        <p className="eyebrow">What happens next</p>
        <ol>
          <li>Resolve the app from your name or requirements.</li>
          <li>Read official API and authentication documentation.</li>
          <li>Return a credential or the exact observed blocker.</li>
        </ol>
        <p className="fine-print">
          GoFetch never enters payment details. Human-only steps stay inside one shared browser
          session.
        </p>
      </aside>
    </main>
  );
}
