# Progress

This file is the durable checkpoint log for the credential-fetching-agent assignment. Each completed checkpoint is committed and pushed before the next begins.

## Working agreement

- Build from the versioned scope specification and automated tests.
- Keep checkpoints small, independently runnable, and recorded here.
- Commit and push every completed checkpoint.
- Never hard-code support for a named app. Any app name or identifying description must take the same generic research, classification, browser-automation, and result-reporting path.
- Use named apps only as test fixtures that exercise distinct paths.

## Checkpoint 0 — Repository and scope baseline

**Status:** complete

- Added the v0.4 scope specification.
- Defined a generic-input contract: every app name is researched and classified dynamically; outcomes are credential, human-assisted acquisition, or a precise observed blocker.
- Defined shared live-browser control, privacy/cleanup, timeout, and payment-wall boundaries.
- Established the spec-first, test-first checkpoint workflow.

**Verification:** `git diff --check` passes.

## Next checkpoint

Create the application skeleton, test runner, and the first red tests for generic input classification. Do not begin browser automation until those foundations are committed and pushed.
