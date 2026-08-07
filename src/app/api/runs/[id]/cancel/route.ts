import { cancelConfiguredBrowserRun } from "@/browser/runtime";
import type { PlannedRunSnapshot } from "@/domain/run";
import { findRun, saveRun } from "@/run/run-store";

interface CancelBrowserDependencies {
  findRun: (id: string) => PlannedRunSnapshot | undefined;
  saveRun: (run: PlannedRunSnapshot) => void;
  cancelRun: () => boolean;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function createCancelBrowserHandler(
  dependencies: CancelBrowserDependencies,
) {
  return async function cancelBrowser(
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

    if (run.state !== "browsing" || !dependencies.cancelRun()) {
      return Response.json(
        {
          error: {
            code: "cancellation_not_available",
            message: "This run has no active browser session to cancel.",
          },
        },
        { status: 409 },
      );
    }

    const cancelledRun: PlannedRunSnapshot = { ...run, state: "cancelled" };
    dependencies.saveRun(cancelledRun);
    return Response.json(cancelledRun);
  };
}

export const POST = createCancelBrowserHandler({
  findRun,
  saveRun,
  cancelRun: cancelConfiguredBrowserRun,
});
