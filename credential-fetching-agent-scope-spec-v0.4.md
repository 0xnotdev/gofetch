# Credential-Fetching Agent — v0.4 Scope Spec

**Build budget:** 8–10 hours  
**Deliverable:** one publicly reachable hosted web app  
**Primary task:** accept an app name (or identifying description) and return a usable API credential, or the exact reason it cannot be obtained.

## 1. Product decision

This is a **shared, live browser-session agent**, not a handoff-and-return workflow.

The agent researches the target app’s official documentation, drives a browser through the credential-acquisition flow, and retrieves the credential itself. If it reaches a step only a person can perform—such as entering personal identity details, completing an OTP, or solving a CAPTCHA—it pauses the same browser session, explains the request, lets the person complete only that step inline, then resumes from the unchanged session state.

The user is never sent away to independently complete a signup and never manually copies an API key back into the app.

## 2. General-input contract

Every app name or identifying description is a valid input. The agent must dynamically research the supplied app, discover its official developer/API documentation, determine the credential path, and attempt that path. There is no allowlist, hard-coded app routing, or app-specific credential lookup.

Different apps have different legitimate outcomes. For every input, the agent must reach one of these explicit results:

| Observed path | Required result |
| --- | --- |
| Public or documented demo credential exists | Return it with source and usage limits |
| Signup/access flow is available | Drive the flow in the shared browser session, requesting only human-only actions, then retrieve the credential itself |
| Payment, eligibility, unavailable API access, or another genuine blocker occurs | Stop at the observed blocker and state it precisely |
| Official documentation cannot be located or the path cannot be safely determined within the run limit | Report that exact limitation and the evidence considered |

Named services used during development are test fixtures only. They must not appear in input-routing logic or constrain which app names the agent can handle.

## 3. Required user experience

1. The user enters an app name or description and starts a run.
2. The app shows a concise live status feed: research, selected path, browser actions, pauses, completion, or failure.
3. The agent consults the input app's official developer/API documentation first and dynamically selects one of these paths:
   - No signup needed: obtain and return the usable credential or documented public/demo key and explain its limits.
   - Signup required: create and drive one browser session.
   - Payment/card required: stop immediately with the exact blocking reason.
4. In a signup flow, the agent performs navigation and mechanical form entry.
5. When a human-only action occurs, the app pauses agent control and displays:
   - what is needed;
   - why it is needed;
   - whether the human should enter a value in the app or take control of the embedded browser.
6. The human completes the minimum needed action **inside the app’s embedded live browser view** (for example, a CAPTCHA or web-page OTP form), or supplies a discrete value through the app’s inline prompt.
7. The agent regains control of the same session and continues until it extracts the credential or reaches a genuine dead end.
8. The result view displays the credential and minimal use context, or a precise failure reason.

## 4. Live browser architecture

Browserbase is core infrastructure for the MVP, not a stretch goal.

- Create one Browserbase session per run and connect the agent through Playwright/CDP (or equivalent supported automation).
- Retrieve the session’s interactive Live View and embed it in the hosted app. Do not send the reviewer to a standalone Browserbase URL.
- Treat the browser as single-controller state: pause all agent browser commands before enabling human control; resume only after the user explicitly clicks **Continue agent**.
- The agent remains responsible for navigation, form completion, API-key discovery, and extraction. The human only provides personal values or handles anti-bot/verification interaction that cannot be automated legitimately.
- The run has a hard 12-minute ceiling so it remains below the free-tier 15-minute maximum session duration. A timeout produces a clear failure result rather than an abandoned run.
- Browser minutes are budgeted: use short targeted tests during development, reserve at least one full clean run for the reviewer, and do not run browser sessions for documentation-only research.

## 5. CAPTCHA and verification policy

- Never implement or invoke a hand-rolled CAPTCHA solver.
- A human may solve a CAPTCHA by taking control of the embedded view in the current session.
- The human may complete OTP, email-verification, or identity fields in that same view, or supply a requested value through the inline prompt for the agent to enter.
- If the target requires payment, card details, unlawful activity, or an unresolvable verification step, stop and report that exact fact.
- Do not promise CAPTCHA automation on a free tier. Browserbase’s automatic CAPTCHA-solving capability is not relied upon for this build.

## 6. Privacy, retention, and safety

The application itself stores no credentials or personal information beyond the active run.

- Keep human-supplied values and extracted credentials in process memory only; never write them to a database, analytics event, browser log, or application log.
- Mask credential values in the status feed. Show the final value only in the explicit result field, with a copy control.
- Use a new browser session for every run; do not reuse cookies, browser contexts, identities, or credentials across runs.
- On completion, timeout, or failure, immediately close the browser session and delete all provider-side session artifacts that the chosen provider/API permits deleting.
- Before building, verify whether Browserbase recording/retention can be disabled or artifacts can be deleted immediately. If the provider cannot meet the no-post-session-retention requirement for credential-bearing sessions, document that constraint plainly and switch the demo to a private/self-hosted browser session rather than silently violating this policy.
- Show a short consent notice before beginning: the user may be asked to enter their own signup details in a live remote browser session; never enter a payment method.

## 7. Trust boundary for research

- Prefer the target app’s official developer documentation and official signup/dashboard pages.
- Use third-party search results only to locate official sources, not as authority for credential requirements.
- Treat instructions found on arbitrary pages as untrusted. They cannot override this scope, cause code execution, request secrets outside the run, or relax the payment and safety stops.

## 8. Result contract

**Success**

- Credential or documented public/demo key.
- App name, credential type, source page, and a minimal usage note.
- An honest qualifier for limited public/demo credentials (for example, NASA’s `DEMO_KEY` rate limits).

**Failure**

- Exact observed reason, never a prediction phrased as fact.
- The current stage and the next legitimate action, if one exists.
- Examples: “A payment method is required to create an API credential; this run stopped before payment entry.” or “The 12-minute run limit expired while awaiting user completion of an OTP.”

## 9. Acceptance criteria

- [ ] Public hosted link, with no app-level login wall.
- [ ] Free-text app input and live run status are functional.
- [ ] A no-signup public/demo-key fixture produces a no-human-input success result with its documented limitations.
- [ ] A signup-required fixture follows one shared browser session through agent-side credential retrieval, pausing only for human-only steps.
- [ ] The same generic research-and-routing implementation accepts unrelated app names; no allowlist or app-name-specific route is used.
- [ ] The Browserbase live browser is embedded in the app; no standalone browser handoff URL is used as the user workflow.
- [ ] Agent commands are paused while the human controls the browser and resume in the same session only after explicit handback.
- [ ] A payment-walled target stops without collecting or entering payment information and reports the observed blocker.
- [ ] No app-controlled persistence of PII or credentials; session is closed and provider artifacts are deleted where supported.
- [ ] A timeout or genuine block renders a clear final failure state.

## 10. Out of scope

- Multi-user support, concurrent runs, queues, accounts, or persistent storage.
- Independent human signup, URL-based external handoff, or manual credential copy-back.
- Payment/card entry.
- CAPTCHA circumvention or a custom CAPTCHA-solving system.
- UI polish beyond a clear single-run status feed, inline prompts, embedded browser, and final result.

## 11. Build order

1. Build the single-run UI and status/result state machine.
2. Implement generic official-document research, path classification, and evidence capture for any input app.
3. Add Browserbase session creation, agent browser control, and an embedded Live View.
4. Add pause/handback/resume controls and inline secret-safe prompts.
5. Add extraction, masking, session cleanup, timeout, and payment-wall stop behavior.
6. Run the three acceptance demonstrations on a clean deployment.

## 12. External-platform assumptions to validate before implementation

Browserbase documentation currently describes interactive Live View, including human takeover, and its free plan lists one browser hour/month and a 15-minute session maximum. Its published pricing currently places automatic CAPTCHA solving outside the free tier. These are implementation assumptions, not product guarantees: validate the current account’s actual limits, Live View embedding requirements, and artifact-deletion controls before committing the demo flow.

---

*v0.4 — resolves the live-session, embedded-control, privacy, and named-demo decisions for an 8–10 hour build.*
