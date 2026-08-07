"use client";

import { FormEvent, useState } from "react";

import type { PlannedRunSnapshot, RunResult, SuccessResult } from "@/domain/run";

const EXAMPLE_QUERY = "A project-management app with a free API";

function isSuccessResult(result: RunResult): result is SuccessResult {
  return (
    result.status === "validated_success" ||
    result.status === "obtained_unverified"
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [run, setRun] = useState<PlannedRunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [humanValue, setHumanValue] = useState("");

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

  async function executeBrowser() {
    if (!run) return;
    setError(null);
    setIsExecuting(true);

    try {
      const response = await fetch(`/api/runs/${run.id}/execute`, {
        method: "POST",
      });
      const body = (await response.json()) as
        | { run: PlannedRunSnapshot }
        | { error: { message: string } };
      if (!response.ok) {
        setError("error" in body ? body.error.message : "Browser execution could not start.");
        return;
      }
      setRun((body as { run: PlannedRunSnapshot }).run);
    } catch {
      setError("GoFetch could not reach the browser runtime. Please try again.");
    } finally {
      setIsExecuting(false);
    }
  }

  async function handBackControl() {
    if (!run?.browser) return;
    setError(null);
    setIsResuming(true);

    try {
      const response = await fetch(`/api/runs/${run.id}/resume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interventionId: run.browser.intervention.id,
          value: humanValue.trim() || undefined,
        }),
      });
      const body = (await response.json()) as
        | { run: PlannedRunSnapshot }
        | { error: { message: string } };
      if (!response.ok) {
        setError("error" in body ? body.error.message : "Control handback failed.");
        return;
      }
      setHumanValue("");
      setRun((body as { run: PlannedRunSnapshot }).run);
    } catch {
      setError("GoFetch could not resume the browser agent. Please try again.");
    } finally {
      setIsResuming(false);
    }
  }

  async function copyCredential() {
    if (
      !run?.result ||
      (run.result.status !== "validated_success" &&
        run.result.status !== "obtained_unverified")
    ) {
      return;
    }
    await navigator.clipboard.writeText(run.result.credential);
  }

  const credentialResult =
    run?.result && isSuccessResult(run.result) ? run.result : null;
  const failureResult =
    run?.result && !isSuccessResult(run.result) ? run.result : null;

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
                  {run.state === "planning" && run.plan.path === "signup_required" ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={executeBrowser}
                      disabled={isExecuting}
                    >
                      {isExecuting ? "Agent workingâ€¦" : "Start browser work"}
                    </button>
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
                  {run.state === "awaiting_human" && run.browser ? (
                    <section className="intervention" aria-label="Human intervention required">
                      <div>
                        <p className="plan-target">Human action needed</p>
                        <p>{run.browser.intervention.prompt}</p>
                        <p className="status-meta">{run.browser.intervention.reason}</p>
                      </div>
                      <div className={`live-view ${isResuming ? "agent-control" : ""}`}>
                        <iframe
                          title="Shared Browserbase live session"
                          src={run.browser.liveViewUrl}
                          sandbox="allow-same-origin allow-scripts"
                          allow="clipboard-read; clipboard-write"
                        />
                        {isResuming ? <div className="control-overlay">Agent has controlâ€¦</div> : null}
                      </div>
                      {[
                        "identity_value",
                        "otp",
                        "magic_link",
                      ].includes(run.browser.intervention.kind) ? (
                        <label className="private-input">
                          Private value (optional if you entered it in the browser)
                          <input
                            type="password"
                            value={humanValue}
                            onChange={(event) => setHumanValue(event.target.value)}
                            autoComplete="off"
                            disabled={isResuming}
                          />
                        </label>
                      ) : null}
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={handBackControl}
                        disabled={isResuming}
                      >
                        {isResuming ? "Resuming agentâ€¦" : "Done â€” hand control back"}
                      </button>
                    </section>
                  ) : null}
                  {credentialResult ? (
                    <section className="credential-result" aria-label="Credential result">
                      <p className="plan-target">
                        {credentialResult.status === "validated_success"
                          ? "Credential validated"
                          : "Credential obtained â€” not validated"}
                      </p>
                      <label>
                        {credentialResult.credentialType.replaceAll("_", " ")}
                        <input
                          className="credential-value"
                          readOnly
                          value={credentialResult.credential}
                          aria-label="Credential value"
                        />
                      </label>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={copyCredential}
                      >
                        Copy credential
                      </button>
                      <p>{credentialResult.usageNote}</p>
                      <p className="status-meta">{credentialResult.validationNote}</p>
                    </section>
                  ) : failureResult ? (
                    <section className="failure-result" aria-label="Run result">
                      <p className="plan-target">Run ended: {failureResult.status}</p>
                      <p>{failureResult.reason}</p>
                      {failureResult.nextAction ? <p>{failureResult.nextAction}</p> : null}
                    </section>
                  ) : null}
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
