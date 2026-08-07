import type { BrowserRunResult } from "@/browser/browser-run-coordinator";
import { executeConfiguredBrowserPlan } from "@/browser/runtime";
import type { CredentialPlan } from "@/domain/credential-plan";
import type { PlannedRunSnapshot } from "@/domain/run";
import { stateForBrowserResult, toRunResult } from "@/run/browser-result";
import { findRun, saveRun } from "@/run/run-store";

interface ExecuteBrowserDependencies {
  findRun: (id: string) => PlannedRunSnapshot | undefined;
  saveRun: (run: PlannedRunSnapshot) => void;
  executePlan: (plan: CredentialPlan) => Promise<BrowserRunResult>;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function createExecuteBrowserHandler(
  dependencies: ExecuteBrowserDependencies,
) {
  return async function executeBrowser(
    _request: Request,
    context: RouteContext,
  ): Promise<Response> {
    const { id } = await context.params;
    const run = dependencies.findRun(id);

    if (!run) {
      return Response.json(
        { error: { code: "run_not_found", message: "This run is no longer available." } },
        { status: 404 },
      );
    }

    if (
      run.state !== "planning" ||
      !run.plan ||
      run.plan.path !== "signup_required"
    ) {
      return Response.json(
        {
          error: {
            code: "browser_execution_not_available",
            message: "This run is not ready for browser execution.",
          },
        },
        { status: 409 },
      );
    }

    const browsingRun: PlannedRunSnapshot = { ...run, state: "browsing" };
    dependencies.saveRun(browsingRun);

    let execution: BrowserRunResult;
    try {
      execution = await dependencies.executePlan(run.plan);
    } catch {
      execution = {
        status: "technical_failure",
        reason: "The browser runtime could not start the requested session.",
      };
    }

    const finishedRun: PlannedRunSnapshot = {
      ...browsingRun,
      state: stateForBrowserResult(execution),
      browser:
        execution.status === "awaiting_human"
          ? {
              sessionId: execution.sessionId,
              liveViewUrl: execution.liveViewUrl,
              currentUrl: execution.currentUrl,
              intervention: execution.intervention,
            }
          : undefined,
      result: toRunResult(execution),
    };
    dependencies.saveRun(finishedRun);

    return Response.json({ run: finishedRun, execution });
  };
}

export const POST = createExecuteBrowserHandler({
  findRun,
  saveRun,
  executePlan: executeConfiguredBrowserPlan,
});
