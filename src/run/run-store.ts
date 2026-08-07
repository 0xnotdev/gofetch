import type { PlannedRunSnapshot } from "@/domain/run";

const runs = new Map<string, PlannedRunSnapshot>();

export function findRun(id: string): PlannedRunSnapshot | undefined {
  return runs.get(id);
}

export function saveRun(run: PlannedRunSnapshot): void {
  runs.set(run.id, run);
}
