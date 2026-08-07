import type {
  BrowserRunResult,
  HumanHandback,
} from "@/browser/browser-run-coordinator";
import { resumeConfiguredBrowserRun } from "@/browser/runtime";
import type { PlannedRunSnapshot } from "@/domain/run";
import { findRun, saveRun } from "@/run/run-store";
import { stateForBrowserResult, toRunResult } from "@/run/browser-result";
import { z } from "zod";

const handbackSchema = z.object({
  interventionId: z.string().min(1),
  value: z.string().min(1).max(4_096).optional(),
});

interface ResumeBrowserDependencies {
  findRun: (id: string) => PlannedRunSnapshot | undefined;
  saveRun: (run: PlannedRunSnapshot) => void;
  resumeRun: (
    sessionId: string,
    handback: HumanHandback,
  ) => Promise<BrowserRunResult>;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function createResumeBrowserHandler(
  dependencies: ResumeBrowserDependencies,
) {
  return async function resumeBrowser(
    request: Request,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const handback = handbackSchema.safeParse(body);

    if (
      run.state !== "awaiting_human" ||
      !run.browser ||
      !handback.success ||
      handback.data.interventionId !== run.browser.intervention.id
    ) {
      return Response.json(
        {
          error: {
            code: "handback_not_available",
            message: "This human-intervention request is no longer active.",
          },
        },
        { status: 409 },
      );
    }

    const execution = await dependencies.resumeRun(
      run.browser.sessionId,
      handback.data,
    );
    const updatedRun: PlannedRunSnapshot = {
      ...run,
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
    dependencies.saveRun(updatedRun);

    return Response.json({ run: updatedRun, execution });
  };
}

export const POST = createResumeBrowserHandler({
  findRun,
  saveRun,
  resumeRun: resumeConfiguredBrowserRun,
});
