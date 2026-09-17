import { describe, it, expect } from "vitest";
import {
  classifyIloLevels,
  gapLevelFromActual,
  perLevelGapCounts,
} from "../../lib/hooks/iloClassification";
import type { GapItem } from "../../lib/types/types";

describe("classifyIloLevels", () => {
  it("orders levels bottom-up (1 -> 6)", () => {
    const rows = classifyIloLevels(3);
    expect(rows.map((r) => r.num)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("classifies a mid-level goal with cascade below and out-of-bound above", () => {
    const rows = classifyIloLevels(3);
    expect(rows.filter((r) => r.cls === "cascade").map((r) => r.num)).toEqual([1, 2]);
    expect(rows.filter((r) => r.cls === "goal").map((r) => r.num)).toEqual([3]);
    expect(rows.filter((r) => r.cls === "out-of-bound").map((r) => r.num)).toEqual([4, 5, 6]);
  });

  it("classifies a level-1 goal with no cascade", () => {
    const rows = classifyIloLevels(1);
    expect(rows.filter((r) => r.cls === "cascade")).toHaveLength(0);
    expect(rows.filter((r) => r.cls === "goal").map((r) => r.num)).toEqual([1]);
    expect(rows.filter((r) => r.cls === "out-of-bound").map((r) => r.num)).toEqual([2, 3, 4, 5, 6]);
  });

  it("classifies a level-6 goal with no out-of-bound", () => {
    const rows = classifyIloLevels(6);
    expect(rows.filter((r) => r.cls === "cascade").map((r) => r.num)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.filter((r) => r.cls === "goal").map((r) => r.num)).toEqual([6]);
    expect(rows.filter((r) => r.cls === "out-of-bound")).toHaveLength(0);
  });
});

describe("gapLevelFromActual", () => {
  it("extracts the RBT level from a gap actual string", () => {
    expect(gapLevelFromActual('Issue: "x" (CLT: Intrinsic, RBT: Level 3)')).toBe(3);
  });

  it("returns null when no level is present", () => {
    expect(gapLevelFromActual("no level here")).toBeNull();
  });
});

describe("perLevelGapCounts", () => {
  const gaps: GapItem[] = [
    {
      iloId: "a",
      expected: "e",
      actual: 'Issue: "x" (CLT: Intrinsic, RBT: Level 3)',
      severity: "medium",
      feedbackId: "f1",
    },
    {
      iloId: "a",
      expected: "e",
      actual: 'Issue: "y" (CLT: Extraneous, RBT: Level 3)',
      severity: "medium",
      feedbackId: "f1",
    },
    {
      iloId: "a",
      expected: "e",
      actual: 'Issue: "z" (CLT: Intrinsic, RBT: Level 1)',
      severity: "medium",
      feedbackId: "f2",
    },
    {
      iloId: "b",
      expected: "e",
      actual: 'Issue: "w" (CLT: Intrinsic, RBT: Level 4)',
      severity: "medium",
      feedbackId: "f3",
    },
  ];

  it("counts unique feedback items per level for the given ILO", () => {
    const counts = perLevelGapCounts(gaps, "a");
    expect(counts.get(3)).toBe(1); // f1 deduped across two level-3 gaps
    expect(counts.get(1)).toBe(1);
    expect(counts.get(4)).toBeUndefined();
  });
});
