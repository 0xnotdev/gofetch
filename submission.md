# GoFetch Submission

## Links

- Live application: [https://gofetch-zw8v.onrender.com](https://gofetch-zw8v.onrender.com)
- Source repository: [https://github.com/0xnotdev/gofetch](https://github.com/0xnotdev/gofetch)
- Product and checkpoint specification: [`scope.md`](./scope.md)
- Architecture and trust boundaries: [`architecture.md`](./architecture.md)
- Incremental build evidence: [`progress.md`](./progress.md)

The Render free instance can take 50 seconds or more to wake after inactivity. The reviewer should wait for the page to load before starting a run.

## What was delivered

GoFetch accepts one free-text input containing either an app name or clear requirements. It uses Browserbase Search and Fetch to locate official evidence, resolves a concrete app without an app allowlist, classifies the credential path, and then either returns an exactly documented public credential, starts a restricted shared browser workflow, or reports the observed limitation. Human-only identity, OTP, magic-link, and CAPTCHA steps use the same embedded live session; payment entry is prohibited.

## Verification status

Checkpoint 7 is currently reopened while the repaired browser runtime is exercised against the full hosted matrix. The results below are historical evidence, not the final acceptance claim.

The latest local quality gate passed on 2026-08-08:

- 71 Vitest tests across 14 files;
- TypeScript type checking;
- ESLint;
- Next.js production build;
- `git diff --check`;
- tracked-secret scan.

The final hosted application was tested after Render reported commit `fee3f12` live:

| Input | Hosted result |
| --- | --- |
| `GitHub` | Preserved the named app, found three exact official sources, and produced a signup-required plan. |
| `a project-management app with a free API` | Dynamically selected Project Manager, explained why, and returned `needs_clarification`/insufficient evidence when the fetched official documentation did not expose a credential. |
| `NASA Open APIs` | Dynamically selected NASA APIs and returned the official `DEMO_KEY` as `obtained_unverified`, with copy control, official-source links, and documented rate limits. |
| `twilio api` | Resolved Twilio and returned a signup-required plan, but the browser result was later found to contain a Model Gateway configuration error. This row is not accepted as a passing signup run. |
| `an API for something useful` | Returned one focused clarification question without silently selecting an app. |

The same-session human handoff was verified separately with Browserbase session `d2783f59-7f63-4784-9f50-d95cdbfca7aa`: automation paused, a human entered `gofetch-human-check` in Live View, automation resumed with the unchanged session ID, and the session closed as `COMPLETED`.

The final third-party signup pause/resume acceptance is still pending. Browserbase project usage reached 77 browser minutes during diagnosis, exceeding the free plan's 60-minute allowance; this external quota failure is not counted as a target blocker or passing result.

## Acceptance audit

| Scope criterion | Result | Evidence |
| --- | --- | --- |
| Public link without app login | Pass | Render URL opens directly to the GoFetch form. |
| Direct app input | Pass | Hosted GitHub and NASA runs preserved/resolved the named targets. |
| Requirements/hints input | Pass | Hosted project-management requirements selected and explained a concrete app. |
| Confirmation before discovered-app side effects | Pass | State-machine, API, UI, and tests require confirmation only before external action. |
| Focused ambiguity handling | Pass | Planner and route tests cover one-question clarification. |
| Public/demo credential | Pass | Hosted NASA run returned the verbatim official `DEMO_KEY` and limitations. |
| Shared browser signup workflow | Pending re-verification | Generic controlled tests pass; a deployed third-party signup pause/resume run is still required. |
| No app allowlist or app-specific routing | Pass | Resolution, research, planning, and browser execution are evidence-driven; named apps appear only in tests and acceptance inputs. |
| Embedded Live View and explicit handback | Pass | UI/API tests and real Browserbase handoff session. |
| Payment stop | Pass | Domain execution tests enforce refusal before payment data entry. |
| Structured success and failure results | Pass | Tests cover validated, unverified, blocker, clarification, technical failure, cancellation, and timeout results. |
| No GoFetch credential/PII persistence | Pass | In-memory-only run state, private variables, no recording/logging, and secret-redaction tests. |
| Official-domain restriction and server-side keys | Pass | Exact source allowlisting, dynamic domain policy, environment-only provider keys, and tracked-secret scan. |
| Quota, concurrency, cancellation, and timeout controls | Pass | One-active-run lock, three-session process quota, throttle, cancellation, force-close, and 12-minute deadline tests. |

## MVP limitations

- The deployment intentionally uses in-memory single-process state and supports one active reviewer run; it is not a multi-user production service.
- A Render free instance sleeps after inactivity, so the first request can be slow.
- Browserbase provider retention is governed by its plan and disclosed in the consent text; GoFetch itself does not persist credentials or personal data.
- External sites can change, block automation, require eligibility/approval, or provide insufficient official evidence. These cases produce an explicit non-success result rather than an invented credential or workaround.
- A returned public credential is labeled `obtained_unverified` unless GoFetch performed a safe official authentication check.
