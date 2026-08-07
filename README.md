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

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Current capability

Checkpoint 1 establishes the web application, typed run contracts, and the first vertical slice: arbitrary non-empty app text can create a run in the `resolving` state. Research and browser execution arrive in subsequent checkpoints.
