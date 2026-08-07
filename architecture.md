# GoFetch Architecture

GoFetch is a single-reviewer Next.js application backed by one long-running Node process. Browserbase supplies official-source Search/Fetch, Model Gateway inference, isolated browser sessions, and an interactive Live View. Stagehand supplies generic semantic browser actions. No app name selects custom code.

## Request flow

1. `POST /api/runs` validates arbitrary free text, searches official sources, resolves a direct or requirements-based target, and classifies the credential path.
2. Public documented credentials and evidence-backed planning blockers terminate without a browser.
3. Requirements-selected apps pause for explicit target confirmation.
4. `POST /api/runs/:id/execute` starts one restricted Browserbase session for a signup path.
5. Stagehand acts only inside the exact official domains derived from the plan. It either returns a credential/result or pauses with one structured human intervention.
6. The page embeds Browserbase Live View. `POST /api/runs/:id/resume` hands control back and continues the same session ID.
7. Every terminal result closes the session and removes Live View metadata.

## Module boundaries

- `src/domain`: typed plans, run states, interventions, and terminal result contracts.
- `src/research`: Browserbase Search/Fetch, schema-validated planning, official-source filtering, and public-credential evidence checks.
- `src/browser`: domain policy, session coordination, Stagehand adapter, quotas, timeout/cancel behavior, and same-session handoff.
- `src/credential`: credential validation, masking, redaction, and result construction.
- `src/run`: in-memory single-reviewer run state and browser-result mapping.
- `src/app`: reviewer UI and thin API route boundaries.

## Trust and secret boundaries

Provider keys stay in server environment variables. Page text, search snippets, and user input are untrusted data inside model prompts. Model-returned source URLs are reduced to exact URLs already returned by Browserbase Search, while browser navigation is limited to exact researched HTTPS hosts. Human values are ephemeral Stagehand variables and extracted credentials appear only in the explicit terminal result.

GoFetch writes no PII or acquired credential to storage or logs. Browserbase provider-side retention is disclosed before consent. Session recording, session logs, and automatic CAPTCHA solving are disabled; payment/card entry is a hard stop.

## Lifecycle and resource limits

The runtime permits one active browser run per process, throttles rapid starts, caps process session creation, applies a 12-minute deadline below Browserbase's 15-minute session maximum, and force-closes on success, failure, timeout, cancellation, or partial initialization. Planning uses one short non-recorded Model Gateway session when a direct Gemini key is absent.

## Deployment choice

`render.yaml` deploys one Node web-service instance. A long-running single process matches the deliberately in-memory run store and same-session coordinator; independent serverless route instances would not. The free Render service may cold-start after idle time or restart and lose an active in-memory run, which is acceptable for this single-reviewer demo but not a multi-user production architecture.

A production expansion would replace the run store and coordinator lease with durable shared state, resume Browserbase sessions by ID after process loss, use distributed quota enforcement, and add authenticated per-user isolation.
