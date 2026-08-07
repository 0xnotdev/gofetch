# GoFetch

GoFetch is a hosted agent that accepts either a specific app name or a clear description of the kind of app a user needs, researches the official API credential path, and works toward a usable credential in a shared live browser session.

**Live app:** [https://gofetch-zw8v.onrender.com](https://gofetch-zw8v.onrender.com)

The complete product contract and delivery checkpoints are in [`scope.md`](./scope.md). Actual implementation progress and verification evidence are recorded in [`progress.md`](./progress.md), and the final acceptance audit is in [`submission.md`](./submission.md).

## Local development

Requirements: Node.js 24 and npm 11.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For live research, configure:

- `BROWSERBASE_API_KEY` for Search, Fetch, browser sessions, Live View, and Model Gateway.
- `BROWSERBASE_BROWSER_MODEL` only when overriding the documented default `google/gemini-2.5-flash` model.
- `GEMINI_API_KEY` optionally, to use a direct Gemini connection for planning instead of Browserbase Model Gateway.
- `GEMINI_MODEL` only when overriding the direct-Gemini default `gemini-3.1-flash-lite` model.

Provider keys are read only by the server runtime and are never returned to the browser.

## Deployment

The production reviewer deployment is live at [gofetch-zw8v.onrender.com](https://gofetch-zw8v.onrender.com). The repository includes a Render Blueprint for the single-process Node deployment this in-memory reviewer demo requires. To create another deployment, create a Blueprint from this repository, provide `BROWSERBASE_API_KEY` when Render prompts for the secret, and let Render use the remaining settings from `render.yaml`.

[Deploy GoFetch to Render](https://render.com/deploy?repo=https://github.com/0xnotdev/gofetch)

See [`architecture.md`](./architecture.md) for the request flow, trust boundaries, lifecycle controls, and deployment tradeoffs.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

After configuring Browserbase, run the quota-conscious one-session connectivity check once:

```bash
npm run check:browserbase
npm run check:model-gateway
```

## Current capability

Six of seven delivery checkpoints are complete; final hosted acceptance is currently reopened. A run can accept either a direct app name or requirements, search and fetch official sources through Browserbase, resolve and classify the path with schema-validated output, reject unverified source URLs, ask one focused clarification question for ambiguous input, require confirmation before acting on a discovered app, and execute a signup plan through a restricted Browserbase session.

The generic Stagehand runtime enforces researched-domain navigation, one active run, session quota and start throttles, a 12-minute timeout, cancellation, payment refusal, and force-close cleanup. Live View supports private inline values or direct human control, followed by explicit handback and same-session agent resume. Credential results enforce official sources and distinguish validated, obtained-but-unverified, and blocked outcomes. See `submission.md` for hosted and same-session acceptance evidence and the explicit MVP limitations.
