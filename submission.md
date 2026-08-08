# GoFetch Submission

## Reviewer links

- **Live application:** [https://gofetch-zw8v.onrender.com](https://gofetch-zw8v.onrender.com)
- **Demo video:** [Watch the end-to-end Loom walkthrough](https://www.loom.com/share/e977968a7a9f43e88875875e01327d72)
- **Source repository:** [https://github.com/0xnotdev/gofetch](https://github.com/0xnotdev/gofetch)
- **Product specification:** [scope.md](./scope.md)
- **Architecture and trust boundaries:** [architecture.md](./architecture.md)
- **Incremental build evidence:** [progress.md](./progress.md)

The Render free instance can take roughly 50 seconds to wake after inactivity. The reviewer should wait for the page to load before starting a run.

## Submission status

**Checkpoint 7 is complete. The assignment is built, tested, deployed, documented, and ready for review.**

GoFetch accepts either a direct app name or clear capability requirements. It researches official sources without an app allowlist, resolves the credential path, and either returns an exactly documented public credential or drives a restricted shared-browser workflow. Human-only identity, OTP, magic-link, and CAPTCHA steps occur inside the same embedded session; after handback, the agent resumes and retrieves the credential itself. Payment entry is prohibited.

## Final verification

The latest clean local quality gate passed on 2026-08-08:

- 104 Vitest tests across 14 files;
- TypeScript type checking;
- ESLint;
- Next.js production build;
- `git diff --check`;
- debug-marker cleanup and tracked-secret checks.

## Hosted acceptance matrix

| Input or scenario | Result |
| --- | --- |
| `Twilio` | User verified the deployed workflow successfully. |
| `Composio` | User verified the deployed workflow; a genuine login handoff resumed in the same browser session, created an API key, and returned the credential. |
| `NASA Open APIs` | Returned the exact official `DEMO_KEY` path as obtained but not independently validated, with documented limitations. |
| `a project-management app with a free API` | Dynamically selected an evidence-backed app, explained the choice, and required confirmation before external action. |
| `an API for something useful` | Asked one focused clarification question rather than silently choosing an app. |
| Docs page plus identity popup | Moved the observed identity flow into the page actually bound to Live View before requesting human action. |
| Repeated sequential browser runs | No artificial three-run process-lifetime failure; real provider quota remains authoritative. |

## Acceptance audit

| Scope criterion | Result | Evidence |
| --- | --- | --- |
| Public link without app login | Pass | Render URL opens directly to the GoFetch form. |
| Direct app input | Pass | User-verified Twilio and Composio hosted workflows. |
| Requirements/hints input | Pass | Hosted capability input selected and explained a concrete app. |
| Confirmation before discovered-app side effects | Pass | State machine, API, UI, and tests require confirmation before browser action. |
| Focused ambiguity handling | Pass | Planner and route tests cover a single clarification question. |
| Public/demo credential | Pass | Hosted NASA run returned the verbatim official `DEMO_KEY` path and limitations. |
| Shared-browser signup workflow | Pass | User-verified hosted login, unchanged-session handback, key creation, and credential return. |
| No app allowlist or app-specific routing | Pass | Research, planning, navigation, and extraction are evidence-driven; production has no named-app branches. |
| Embedded Live View and explicit handback | Pass | Real Browserbase handoff plus target-bound popup regressions and hosted visual verification. |
| Payment stop | Pass | Browser execution refuses payment/card entry. |
| Structured success and failure results | Pass | Tests cover validated, unverified, blocker, clarification, technical failure, cancellation, and timeout outcomes. |
| No GoFetch credential/PII persistence | Pass | In-memory-only run state, ephemeral private variables, disabled recording/logging, and redaction tests. |
| Official-domain restriction and server-side keys | Pass | Verified HTTPS source policy, related-domain checks, environment-only provider keys, and secret scan. |
| Quota, concurrency, cancellation, and timeout controls | Pass | One-active-run lock, provider-quota reporting, throttle, cancellation, force-close, and 12-minute deadline tests. |
| Clean repository quality gate | Pass | 104 tests, typecheck, lint, production build, diff check, and documentation audit. |

## MVP limitations

- The deployment intentionally uses in-memory single-process state and supports one active reviewer browser run; it is not a multi-user production credential service.
- A Render free instance sleeps after inactivity and can restart, which ends any active in-memory run.
- Browserbase allowance and provider retention are governed by the configured Browserbase account and disclosed in the consent text.
- External sites can change, block automation, require eligibility or payment, or expose insufficient official evidence. GoFetch reports these as non-success outcomes rather than fabricating credentials.
- A credential is marked validated only after a safe official authentication check actually succeeds; otherwise it is explicitly labeled obtained but not validated.
