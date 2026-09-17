import { RBT_LEVEL_NUMBERS } from "@/lib/algorithm/rules";
import type { GapItem } from "@/lib/types/types";

export type IloLevelClass = "goal" | "cascade" | "out-of-bound";

export interface IloLevelRow {
  label: string;
  num: number;
  cls: IloLevelClass;
}

/**
 * Classifies all 6 Bloom levels relative to an ILO's goal level, ordered
 * bottom-up (1 -> 6). Levels below the goal are cascade (foundation),
 * the goal itself is the primary target, and levels above are out-of-bound.
 */
export function classifyIloLevels(goalLevel: number): IloLevelRow[] {
  return Object.entries(RBT_LEVEL_NUMBERS)
    .sort((a, b) => a[1] - b[1])
    .map(([label, num]) => ({
      label,
      num,
      cls: num === goalLevel ? "goal" : num < goalLevel ? "cascade" : "out-of-bound",
    }));
}

/** Extracts the RBT level embedded in a gap item's `actual` string. */
export function gapLevelFromActual(actual: string): number | null {
  const match = actual.match(/RBT: Level (\d+)/);
  return match ? Number(match[1]) : null;
}

/** Counts unique feedback items with gaps per RBT level for one ILO. */
export function perLevelGapCounts(gaps: GapItem[], iloId: string): Map<number, number> {
  const byLevel = new Map<number, Set<string>>();
  for (const gap of gaps) {
    if (gap.iloId !== iloId) continue;
    const level = gapLevelFromActual(gap.actual);
    if (level == null) continue;
    const id = gap.feedbackId ?? `legacy:${iloId}:${gap.actual}`;
    if (!byLevel.has(level)) byLevel.set(level, new Set());
    byLevel.get(level)!.add(id);
  }
  return new Map([...byLevel].map(([level, ids]) => [level, ids.size]));
}
