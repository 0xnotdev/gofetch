"use client";

import { FormEvent, useState } from "react";

import type { PlannedRunSnapshot } from "@/domain/run";

const EXAMPLE_QUERY = "A project-management app with a free API";

export default function Home() {
  const [query, setQuery] = useState("");
  const [run, setRun] = useState<PlannedRunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

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
      const body = (await response.json()) as PlannedRunSnapshot | {
        error: { message: string };
      };

      if (!response.ok) {
        setError("error" in body ? body.error.message : "The run could not be started.");
        return;
      }

      setRun(body as PlannedRunSnapshot);
    } catch {
      setError("GoFetch could not reach its server. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  async function confirmTarget() {
    if (!run) return;

    setError(null);
    setIsConfirming(true);

    try {
      const response = await fetch(`/api/runs/${run.id}/confirm`, { method: "POST" });
      const body = (await response.json()) as PlannedRunSnapshot | {
        error: { message: string };
      };

      if (!response.ok) {
        setError("error" in body ? body.error.message : "The target could not be confirmed.");
        return;
      }

      setRun(body as PlannedRunSnapshot);
    } catch {
      setError("GoFetch could not confirm the target. Please try again.");
    } finally {
      setIsConfirming(false);
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
              {run.plan ? (
                <div className="plan">
                  <p className="plan-target">
                    {run.plan.appName ? `Selected app: ${run.plan.appName}` : "More detail needed"}
                  </p>
                  <p>{run.plan.selectionReason}</p>
                  <p>{run.plan.summary}</p>
                  <p className="status-meta">Credential path: {run.plan.path}</p>
                  {run.plan.clarificationQuestion ? (
                    <p className="confirmation-note">{run.plan.clarificationQuestion}</p>
                  ) : null}
                  {run.plan.requiresConfirmation ? (
                    run.targetConfirmedAt ? (
                      <p className="confirmation-note">Target confirmed. Browser work may proceed.</p>
                    ) : (
                      <div className="confirmation-box">
                        <p className="confirmation-note">
                          Confirm this target before GoFetch creates an account or takes another
                          external action.
                        </p>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={confirmTarget}
                          disabled={isConfirming}
                        >
                          {isConfirming ? "Confirming…" : `Use ${run.plan.appName}`}
                        </button>
                      </div>
                    )
                  ) : null}
                  <ul className="source-list" aria-label="Official sources">
                    {run.plan.officialSources.map((source) => (
                      <li key={source}>
                        <a href={source} target="_blank" rel="noreferrer">
                          {new URL(source).hostname}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
