import type { BrowserRunResult } from "../browser/browser-run-coordinator";
import type { RunResult, RunState } from "../domain/run";

export function stateForBrowserResult(result: BrowserRunResult): RunState {
  switch (result.status) {
    case "validated_success":
    case "obtained_unverified":
    case "awaiting_human":
    case "blocked":
    case "cancelled":
    case "timed_out":
    case "technical_failure":
      return result.status;
    case "completed":
      return "browsing";
  }
}

export function toRunResult(
  result: BrowserRunResult,
): RunResult | undefined {
  if (
    result.status === "validated_success" ||
    result.status === "obtained_unverified"
  ) {
    const { sessionId: _sessionId, currentUrl: _currentUrl, ...success } =
      result;
    return success;
  }

  if (
    result.status === "blocked" ||
    result.status === "technical_failure" ||
    result.status === "cancelled" ||
    result.status === "timed_out"
  ) {
    return {
      status: result.status,
      reason: result.reason,
      stage: "browsing",
      evidence: "currentUrl" in result ? [result.currentUrl] : [],
    };
  }

  return undefined;
}
