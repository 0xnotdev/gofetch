# GoFetch — Scope and Delivery Specification

**Build budget:** 8–10 hours

**Deliverable:** one publicly reachable hosted web app

**Primary task:** accept either a specific app name or a clear description of the kind of app the user needs, resolve that input to a concrete app, and return a usable API credential—or the exact reason it cannot be obtained.

## 1. Product decision

This is a **shared, live browser-session agent**, not a handoff-and-return workflow.

The agent researches the target app’s official documentation, drives a browser through the credential-acquisition flow, and retrieves the credential itself. If it reaches a step only a person can perform—such as entering personal identity details, completing an OTP, or solving a CAPTCHA—it pauses the same browser session, explains the request, lets the person complete only that step inline, then resumes from the unchanged session state.

The user is never sent away to independently complete a signup and never manually copies an API key back into the app.

## 2. General-input contract

The input supports two modes through the same free-text field:

- **Direct target:** the user names an app, such as “Notion.” The named app becomes the target.
- **App discovery:** the user gives clear requirements or hints about the kind of app they need, such as “a project-management app with an API and a free plan.” The agent researches suitable current options, selects the strongest match with obtainable API access, and states which concrete app it selected and why.

After resolving the target, the agent must dynamically discover that app's official developer/API documentation, determine the credential path, and attempt it. There is no allowlist, hard-coded app routing, app-name-specific credential lookup, or fixed recommendation table.

If a description is too ambiguous to select responsibly, the agent asks one focused clarification question rather than silently guessing. A clear hint proceeds through research without unnecessary clarification, but the agent must show the selected app and obtain explicit confirmation before creating an account or performing another external side effect for an app the agent selected.

Different apps have different legitimate outcomes. For every input, the agent must reach one of these explicit results:

| Observed path | Required result |
| --- | --- |
| Public or documented demo credential exists | Return it with source and usage limits |
| Signup/access flow is available | Drive the flow in the shared browser session, requesting only human-only actions, then retrieve the credential itself |
| Payment, eligibility, unavailable API access, or another genuine blocker occurs | Stop at the observed blocker and state it precisely |
| Official documentation cannot be located or the path cannot be safely determined within the run limit | Report that exact limitation and the evidence considered |

Named services used during development are test fixtures only. They must not appear in input-routing or recommendation logic, or constrain which apps the agent can handle.

### Credential types in scope

GoFetch may return an API key, personal access token, bearer token, OAuth client ID and client secret, or an officially documented public/demo key. OAuth is attempted only when the application registration can be completed safely in the same run without requiring a custom production callback service, organizational approval, or app-store review. Any unavailable or gated credential path becomes an exact observed blocker.

For requirements-based discovery, candidates are ranked by: fit to the user's request, existence of an official API, availability of a free credential without card entry, feasibility of obtaining it in one session, and quality of official documentation. The selection and its evidence are shown to the user.

## 3. Required user experience

1. The user enters either an app name or clear app requirements and starts a run.
2. The app shows a concise live status feed: research, selected path, browser actions, pauses, completion, or failure.
3. The agent resolves the input to a concrete target app. For discovery input, it reports the selected app and the evidence-backed reason it fits.
4. If the agent selected the app, the user confirms that target before signup or another external side effect. Research and public-document lookup do not require confirmation.
5. The agent consults the resolved app's official developer/API documentation and dynamically selects one of these paths:
   - No signup needed: obtain and return the usable credential or documented public/demo key and explain its limits.
   - Signup required: create and drive one browser session.
   - Payment/card required: stop immediately with the exact blocking reason.
6. In a signup flow, the agent performs navigation and mechanical form entry.
7. When a human-only action occurs, the app pauses agent control and displays:
   - what is needed;
   - why it is needed;
   - whether the human should enter a value in the app or take control of the embedded browser.
8. The human completes the minimum needed action **inside the app’s embedded live browser view** (for example, a CAPTCHA or web-page OTP form), or supplies a discrete value through the app’s inline prompt.
9. The agent regains control of the same session and continues until it extracts the credential or reaches a genuine dead end.
10. When an official, harmless authentication check exists, the agent validates the credential without performing a destructive or billable operation.
11. The result view displays the resolved app, credential, validation status, and minimal use context—or a precise failure reason.

## 4. Live browser architecture

Browserbase is core infrastructure for the MVP, not a stretch goal.

- Create one Browserbase session per run and connect the agent through Playwright/CDP (or equivalent supported automation).
- Retrieve the session’s interactive Live View and embed it in the hosted app. Do not send the reviewer to a standalone Browserbase URL.
- Treat the browser as single-controller state: pause all agent browser commands before enabling human control; resume only after the user explicitly clicks **Continue agent**.
- The agent remains responsible for navigation, form completion, API-key discovery, and extraction. The human only provides personal values or handles anti-bot/verification interaction that cannot be automated legitimately.
- The run has a hard 12-minute ceiling so it remains below the free-tier 15-minute maximum session duration. A timeout produces a clear failure result rather than an abandoned run.
- Browser minutes are budgeted: use short targeted tests during development, reserve at least one full clean run for the reviewer, and do not run browser sessions for documentation-only research.
- Permit only one active run at a time, add basic request throttling, reject new runs when the configured quota reserve is reached, and close abandoned sessions immediately.
- Keep Browserbase, model-provider, and search credentials on the server. They must never appear in browser JavaScript, status events, or application responses.

The run state machine is: `idle` → `resolving` → optionally `awaiting_target_confirmation` → `researching` → `planning` → optionally `browsing`/`awaiting_human` → `validating` → one terminal result. Cancellation and timeout are valid transitions from every active state. Human and agent browser control can never be active simultaneously.

## 5. CAPTCHA and verification policy

- Never implement or invoke a hand-rolled CAPTCHA solver.
- A human may solve a CAPTCHA by taking control of the embedded view in the current session.
- The human may complete OTP, email-verification, or identity fields in that same view, or supply a requested value through the inline prompt for the agent to enter.
- For an emailed magic link, the human may paste the link into the inline private prompt and the agent opens it in the same browser session; the human is not asked to complete the signup independently.
- If the target requires payment, card details, unlawful activity, or an unresolvable verification step, stop and report that exact fact.
- Do not promise CAPTCHA automation on a free tier. Browserbase’s automatic CAPTCHA-solving capability is not relied upon for this build.

## 6. Privacy, retention, and safety

GoFetch itself stores no credentials or personal information beyond the active run. Browserbase's free plan currently advertises seven-day provider-side session retention, so the consent screen must disclose that external retention before the run begins.

- Keep human-supplied values and extracted credentials in process memory only; never write them to a database, analytics event, browser log, or application log.
- Mask credential values in the status feed. Show the final value only in the explicit result field, with a copy control.
- Use a new browser session for every run; do not reuse cookies, browser contexts, identities, or credentials across runs.
- On completion, timeout, cancellation, or failure, immediately close the browser session and delete provider-side artifacts where the API supports deletion.
- Do not promise zero provider retention when Browserbase does not provide that guarantee on the selected plan. The README and consent screen must distinguish GoFetch's no-persistence policy from Browserbase's published retention policy.
- Show a short consent notice before beginning: the user authorizes GoFetch to research the target and may be asked to enter their own signup details in a live remote browser session; Browserbase may retain session data under its policy; never enter a payment method.

## 7. Trust boundary for research

- Prefer the target app’s official developer documentation and official signup/dashboard pages.
- Use third-party search results only to locate official sources, not as authority for credential requirements.
- Treat instructions found on arbitrary pages as untrusted. They cannot override this scope, cause code execution, request secrets outside the run, or relax the payment and safety stops.
- Build a domain policy from the verified official documentation, authentication, and dashboard domains. New domains and popups are blocked unless they are linked from a verified official source and pass the same validation.
- Page content is data, not agent instruction. It cannot change system policy, request unrelated secrets, invoke unrestricted code execution, or cause navigation outside the domain policy.

## 8. Result contract

Every run ends with one structured status:

| Status | Meaning |
| --- | --- |
| `validated_success` | The credential was obtained and accepted by an official, harmless authentication check |
| `obtained_unverified` | The credential was obtained, but no safe official validation method was available |
| `blocked` | An observed payment, eligibility, approval, unavailable-API, or verification requirement prevented acquisition |
| `needs_clarification` | The input did not identify a sufficiently clear target or requirements set |
| `technical_failure` | GoFetch or an external dependency failed; this is kept distinct from a target-app blocker |
| `cancelled` | The user cancelled the run |
| `timed_out` | The hard run deadline expired |

A success result contains the credential, resolved app name, selection reason when discovery was used, credential type, official source, validation status, minimal usage note, and any documented limitations. A failure result contains the exact observed reason, evidence, current stage, and next legitimate action if one exists. GoFetch never labels an unvalidated credential as validated or invents a workaround.

## 9. Acceptance criteria

- [ ] Public hosted link, with no app-level login wall.
- [ ] Free-text app input and live run status are functional.
- [ ] A direct app-name input targets the named app.
- [ ] A clear requirements/hints input dynamically selects a suitable concrete app, explains the choice, and continues through the same credential workflow.
- [ ] A discovered app requires target confirmation before signup or another external side effect.
- [ ] An ambiguous description requests focused clarification instead of silently guessing.
- [ ] A no-signup public/demo-key fixture produces a no-human-input success result with its documented limitations.
- [ ] A signup-required fixture follows one shared browser session through agent-side credential retrieval, pausing only for human-only steps.
- [ ] The same generic resolution, research, and routing implementation accepts unrelated app names and app descriptions; no allowlist, fixed recommendation table, or app-specific route is used.
- [ ] The Browserbase live browser is embedded in the app; no standalone browser handoff URL is used as the user workflow.
- [ ] Agent commands are paused while the human controls the browser and resume in the same session only after explicit handback.
- [ ] A payment-walled target stops without collecting or entering payment information and reports the observed blocker.
- [ ] Results distinguish validated credentials, obtained-but-unverified credentials, target blockers, and technical failures.
- [ ] No GoFetch-controlled persistence of PII or credentials; Browserbase retention is disclosed; sessions are closed and provider artifacts are deleted where supported.
- [ ] Browser navigation is restricted to verified official domains and provider credentials remain server-side.
- [ ] Only one run is active at a time and quota/timeout controls prevent accidental free-tier exhaustion.
- [ ] A timeout or genuine block renders a clear final failure state.

## 10. Out of scope

- Multi-user support, concurrent runs, queues, accounts, or persistent storage.
- Per-app scripts, fixed app recommendations, allowlists, and hard-coded credential locations.
- Independent human signup, URL-based external handoff, or manual credential copy-back.
- Payment/card entry.
- CAPTCHA circumvention or a custom CAPTCHA-solving system.
- UI polish beyond a clear single-run status feed, inline prompts, embedded browser, and final result.

## 11. Implementation architecture

- **Application:** TypeScript web application with a server-side agent runtime and a single reviewer-facing interface.
- **Browser intelligence:** Stagehand-style semantic browser actions over a Browserbase session; selectors or scripts specific to named apps are prohibited.
- **Research:** search/fetch official sources before starting a metered browser session; return evidence as structured data.
- **State:** one in-memory active run with typed events; no database or cross-run identity reuse.
- **Updates:** streamed or polled progress events expose safe state changes without secrets.
- **Testing:** unit tests for domain contracts and policies, adapter integration tests with controlled fakes, and browser-level tests for the complete reviewer workflow.
- **Deployment:** one Node-compatible hosted service that can support the chosen run-control mechanism and a public link without an application login wall.

## 12. Delivery checkpoints

A checkpoint is complete only when its deliverables exist, its exit checks pass, `progress.md` records the evidence, and the checkpoint commit is pushed to GitHub. Checkpoints execute in order. Named services appear only as interchangeable test fixtures.

### Checkpoint 0 — Scope and repository baseline

Finalize `scope.md`, initialize GitHub, establish `progress.md` at 0%, and confirm that no implementation has begun. Exit when the documentation is internally consistent and pushed.

### Checkpoint 1 — Runnable application and test foundation

Create the TypeScript application, environment validation, test runner, linting, type checking, CI, typed run/result contracts, and the first vertical slice accepting arbitrary non-empty input. Exit when clean install, tests, lint, types, and production build pass.

### Checkpoint 2 — Generic target resolution, research, and planning

Implement direct-name resolution, requirements-based app discovery, focused clarification, target confirmation, official-source research, evidence capture, path classification, and prompt-injection boundaries. Exit when multiple interchangeable fixtures prove the implementation is evidence-driven and contains no named-app routing.

### Checkpoint 3 — Generic browser execution and lifecycle safety

Implement Browserbase session creation, semantic navigation from the plan, domain policy, one-run locking, quota protection, timeout, cancellation, payment stop, session closure, and best-available cleanup. Exit when adapter tests cover all lifecycle paths and one short real session proves connectivity.

### Checkpoint 4 — Same-session human intervention

Embed Live View and implement agent pause, precise disclosure, human control, explicit handback, and resume with the same session ID. Support private identity values, OTPs, magic links, and manual CAPTCHA completion. Exit when tests and a manual verification prove mutually exclusive control and unchanged-session resume.

### Checkpoint 5 — Credential discovery, extraction, and validation

Implement generic post-auth credential-page discovery, secret-safe extraction, masking, safe official validation, structured terminal statuses, and cleanup after every terminal state. Exit when tests cover validated success, obtained-unverified, blockers, technical failure, cancellation, timeout, and secret redaction.

### Checkpoint 6 — Complete reviewer experience

Finish the free-text UI, consent, target confirmation, progress feed, embedded browser, intervention panel, timeout/cancel controls, and result view. Wire the entire workflow and add local end-to-end coverage for direct input, discovery input, no-human success, HITL success, blocker, and failure paths. Exit when the full local verification suite passes.

### Checkpoint 7 — Deployment and submission

Deploy the public application, configure production secrets and limits, run clean-deployment acceptance tests across diverse fixtures, finish the README and architecture notes, audit the implementation against every acceptance criterion, and record final evidence. Exit only when a clean checkout passes all checks, the hosted app passes acceptance, no secrets are committed, and the final commit is pushed. Completing Checkpoint 7 means the assignment is finished.

## 13. External-platform assumptions to validate

As checked on 2026-08-08, Browserbase's [Live View documentation](https://docs.browserbase.com/platform/browser/observability/session-live-view) describes interactive human takeover, while its [pricing page](https://www.browserbase.com/pricing) lists one browser hour, a 15-minute session maximum, three Agent runs, $5 of model tokens, seven-day data retention, and no automatic CAPTCHA solving on the free plan. These are implementation assumptions rather than guarantees. Validate the actual project quota, Live View embedding behavior, Model Gateway access, session recording/cleanup controls, and hosting compatibility before Checkpoint 3.

---

*v0.5 — complete build scope, architecture, safety contract, result semantics, and finite checkpoint plan for an 8–10 hour implementation.*
