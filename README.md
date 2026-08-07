# GoFetch

GoFetch is a hosted agent that accepts either a specific app name or a clear description of the kind of app a user needs, researches the official API credential path, and works toward a usable credential in a shared live browser session.

The complete product contract and delivery checkpoints are in [`scope.md`](./scope.md). Actual implementation progress and verification evidence are recorded in [`progress.md`](./progress.md).

## Local development

Requirements: Node.js 24 and npm 11.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For live research, configure:

- `BROWSERBASE_API_KEY` for Browserbase Search and Fetch.
- `GEMINI_API_KEY` for structured target resolution and credential-path planning.
- `GEMINI_MODEL` only when overriding the default `gemini-3.1-flash-lite` model.

Provider keys are read only by the server runtime and are never returned to the browser.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Current capability

Checkpoints 1 and 2 establish the application foundation and generic planning flow. A run can accept either a direct app name or requirements, search and fetch official sources through Browserbase, resolve and classify the path with schema-validated Gemini output, reject unverified source URLs, ask one focused clarification question for ambiguous input, and require confirmation before acting on a discovered app.

Browser execution and live human takeover arrive in the next checkpoints.
