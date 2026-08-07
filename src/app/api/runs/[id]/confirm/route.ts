import type { PlannedRunSnapshot } from "@/domain/run";
import { findRun, saveRun } from "@/run/run-store";

interface ConfirmTargetDependencies {
  findRun: (id: string) => PlannedRunSnapshot | undefined;
  saveRun: (run: PlannedRunSnapshot) => void;
  now?: () => Date;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function createConfirmTargetHandler(dependencies: ConfirmTargetDependencies) {
  return async function confirmTarget(
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

    if (run.state !== "awaiting_target_confirmation" || !run.plan) {
      return Response.json(
        {
          error: {
            code: "confirmation_not_available",
            message: "This run is not waiting for target confirmation.",
          },
        },
        { status: 409 },
      );
    }

    const updated: PlannedRunSnapshot = {
      ...run,
      state: "planning",
      targetConfirmedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    };
    dependencies.saveRun(updated);

    return Response.json(updated);
  };
}

export const POST = createConfirmTargetHandler({ findRun, saveRun });
