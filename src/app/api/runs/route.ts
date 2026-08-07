import { runRequestSchema, type PlannedRunSnapshot } from "@/domain/run";
import type { CredentialPlan } from "@/domain/credential-plan";
import { createCredentialResult } from "@/credential/credential-result";
import { buildConfiguredCredentialPlan } from "@/research/runtime";
import { saveRun } from "@/run/run-store";

function invalidRequest(): Response {
  return Response.json(
    {
      error: {
        code: "invalid_request",
        message: "Enter an app name or describe the kind of app you need.",
      },
    },
    { status: 400 },
  );
}

interface PostRunsDependencies {
  buildPlan?: (query: string) => Promise<CredentialPlan>;
  saveRun?: (run: PlannedRunSnapshot) => void;
}

export function createPostRunsHandler(dependencies: PostRunsDependencies = {}) {
  return async function postRuns(request: Request): Promise<Response> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return invalidRequest();
    }

    const parsed = runRequestSchema.safeParse(body);

    if (!parsed.success) {
      return invalidRequest();
    }

    const run: PlannedRunSnapshot = {
      id: crypto.randomUUID(),
      query: parsed.data.query,
      state: "resolving",
      createdAt: new Date().toISOString(),
    };

    if (dependencies.buildPlan) {
      let plan: CredentialPlan;

      try {
        plan = await dependencies.buildPlan(parsed.data.query);
      } catch {
        return Response.json(
          {
            error: {
              code: "research_failed",
              message: "GoFetch could not complete official-source research for this run.",
            },
          },
          { status: 502 },
        );
      }

      run.plan = plan;
      if (plan.path === "public_credential" && plan.publicCredential) {
        run.result = createCredentialResult(plan, {
          ...plan.publicCredential,
          validationStatus: "not_validated",
          validationNote: plan.publicCredential.limitations,
        });
        run.state = "obtained_unverified";
      } else if (plan.path === "blocked") {
        run.state = "blocked";
        run.result = {
          status: "blocked",
          reason: plan.blocker ?? plan.summary,
          stage: "planning",
          evidence: plan.officialSources,
        };
      } else if (plan.path === "insufficient_evidence") {
        run.state = "needs_clarification";
        run.result = {
          status: "needs_clarification",
          reason: plan.blocker ?? plan.summary,
          stage: "planning",
          evidence: plan.officialSources,
          ...(plan.clarificationQuestion
            ? { nextAction: plan.clarificationQuestion }
            : {}),
        };
      } else {
        run.state = plan.requiresConfirmation
          ? "awaiting_target_confirmation"
          : "planning";
      }
    }

    dependencies.saveRun?.(run);
    return Response.json(run, { status: 201 });
  };
}

export const POST = createPostRunsHandler({
  buildPlan: buildConfiguredCredentialPlan,
  saveRun,
});
