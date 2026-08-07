import type { PlannedRunSnapshot } from "@/domain/run";

export function canConfirmTarget(run: PlannedRunSnapshot): boolean {
  return (
    run.state === "awaiting_target_confirmation" &&
    run.plan?.inputMode === "discovery" &&
    run.plan.requiresConfirmation
  );
}
