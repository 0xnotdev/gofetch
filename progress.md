# Progress

This file is both the finite delivery roadmap and the durable checkpoint log for the credential-fetching-agent assignment. Completing Checkpoint 7 means the entire assignment is built, verified, deployed, and ready to submit.

## Working agreement

- Build from the versioned scope specification and automated tests.
- Execute checkpoints in order. A checkpoint may contain small red-green test cycles, but no later checkpoint begins before the current checkpoint exits cleanly.
- A checkpoint is complete only when its stated deliverables exist, its verification commands pass, this file records the evidence, and the checkpoint commit is pushed to GitHub.
- Commit and push useful interim progress when needed; every completed checkpoint always ends in a clean pushed commit.
- Never hard-code support or recommendations for named apps. A direct app name or clear app requirements must take the same generic resolution, research, classification, browser-automation, and result-reporting path.
- Use named apps only as test fixtures that exercise distinct paths.
- If scope changes, update the scope spec and this roadmap in the same checkpoint.

## Delivery roadmap

| Checkpoint | Outcome | Status |
| --- | --- | --- |
| 0 | Repository, scope, and delivery roadmap established | Complete |
| 1 | Runnable application and test foundation | Pending |
| 2 | Generic research and credential-path planning | Pending |
| 3 | Generic browser execution and lifecycle safety | Pending |
| 4 | Same-session human-in-the-loop takeover and resume | Pending |
| 5 | Credential discovery, validation, and terminal results | Pending |
| 6 | Complete user-facing workflow and integration coverage | Pending |
| 7 | Production deployment, end-to-end acceptance, and submission package | Pending |

## Checkpoint 0 — Repository and scope baseline

**Status:** complete

- Added the v0.4 scope specification.
- Defined a generic-input contract: every app name is researched and classified dynamically; outcomes are credential, human-assisted acquisition, or a precise observed blocker.
- Defined shared live-browser control, privacy/cleanup, timeout, and payment-wall boundaries.
- Established the spec-first, test-first checkpoint workflow.
- Defined the complete checkpoint roadmap and the exit rule for each checkpoint.

**Evidence:** initial baseline commit `a247119` was pushed to `origin/main`; the roadmap clarification is recorded in the next pushed commit.

**Verification:** `git diff --check` passes and the local branch tracks `origin/main`.

## Checkpoint 1 — Runnable application and test foundation

**Status:** pending

**Deliverables:**

- TypeScript web application with documented local commands and environment-variable validation.
- Test runner, linting, type checking, and a CI workflow.
- Public domain contracts for a run request, progress event, human-intervention request, successful credential result, and failure result.
- First vertical slice: submit arbitrary non-empty app text and observe a created run through the public application boundary.

**Exit criteria:** clean install succeeds; unit/integration tests, type checking, linting, and production build pass; no app-name allowlist exists.

## Checkpoint 2 — Generic research and credential-path planning

**Status:** pending

**Deliverables:**

- Input-resolution pipeline that either accepts a directly named app or dynamically selects a suitable concrete app from clear user requirements, explaining the evidence-backed choice.
- Research pipeline that starts from the resolved app and locates official developer/API sources dynamically.
- Structured, evidence-backed plan classifying the observed route as public credential, signup/access flow, payment/eligibility block, or insufficient verified evidence.
- Prompt-injection and untrusted-page boundaries enforced at the research seam.
- Tests use multiple interchangeable direct-name and requirements-based fixtures to prove resolution and routing are evidence-driven rather than app-name-driven.

**Exit criteria:** direct-name, clear-hint, and ambiguous-hint tests pass; classification tests pass for all result types; unrelated inputs traverse the same implementation; and selection/source evidence appears in the returned plan.

## Checkpoint 3 — Generic browser execution and lifecycle safety

**Status:** pending

**Deliverables:**

- Browserbase session creation and generic agent-controlled navigation from the research plan.
- Mechanical signup/dashboard actions driven from current page state rather than per-app scripts.
- Hard timeout, payment/card stop, cancellation, session closure, and best-available artifact cleanup.
- Provider limitations and required configuration documented.

**Exit criteria:** mocked integration tests cover create, act, stop, timeout, and cleanup; at least one short real session proves connectivity without encoding a named-app route.

## Checkpoint 4 — Same-session human-in-the-loop takeover and resume

**Status:** pending

**Deliverables:**

- Embedded interactive Live View for the active browser session.
- Agent pause before human control, precise disclosure of the requested action, explicit handback, and agent resume in the unchanged session.
- Inline handling for identity values, OTPs, and manual CAPTCHA completion without independent signup or credential copy-back.
- Controller-state tests prevent simultaneous human and agent browser control.

**Exit criteria:** integration test and recorded manual verification demonstrate pause, takeover, handback, and resume using one session ID.

## Checkpoint 5 — Credential discovery, validation, and terminal results

**Status:** pending

**Deliverables:**

- Generic post-authentication discovery of credential-management pages from documentation and observed UI state.
- Secret-safe extraction and masking; no credentials or PII in logs, analytics, files, or persisted application state.
- Non-destructive credential validation when an official verification method is available.
- Structured success and exact observed-failure results, including limits and source context.

**Exit criteria:** tests cover successful extraction, masked progress, validation, unavailable validation, exact blockers, and cleanup after every terminal state.

## Checkpoint 6 — Complete user-facing workflow and integration coverage

**Status:** pending

**Deliverables:**

- Finished single-run UI: free-text input, consent, live progress, human-action panel, embedded browser, timeout/cancel controls, and final result.
- End-to-end application wiring across research, planning, browser execution, HITL, extraction, and failure reporting.
- Responsive, accessible reviewer experience with clear recovery from configuration and provider errors.

**Exit criteria:** local end-to-end tests cover direct app input, requirements-based app discovery, no-human success, HITL success, observed blocker, timeout, and arbitrary unrelated input; full verification suite passes.

## Checkpoint 7 — Production deployment and submission

**Status:** pending

**Deliverables:**

- Public hosted URL with production configuration and no app-level login wall.
- Clean-deployment acceptance run across diverse test fixtures using the generic implementation.
- README with architecture, setup, environment variables, safety limits, test commands, deployment instructions, and known external-platform constraints.
- Final spec/implementation audit and completed acceptance checklist.

**Exit criteria:** the hosted application passes the full acceptance criteria in the scope spec; all automated checks pass from a clean checkout; no secrets are committed; `progress.md` contains evidence and commit references for every checkpoint; the final commit is pushed to GitHub.

**Completion rule:** once Checkpoint 7 is marked complete and pushed, the assignment is complete. No known required build, test, deployment, or documentation work remains.

## Current checkpoint

Checkpoint 1 — Runnable application and test foundation.
