import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  computeGoalSubRows,
  computeOutOfScopeLevels,
  declareGoalLevels,
  directGapsForIlo,
  distinctGapsAtLevel,
  formatGapLabel,
  GapFeedbackList,
  goalAccentRate,
  IloGapCard,
  pillForLevel,
  rateToAccent,
  resolveCascade,
} from "../../components/faculty/charts/IloGapCard";
import type { IloStatus } from "../../lib/hooks/iloStatus";
import type { Feedback, GapItem, ILO } from "../../lib/types/types";

function makeStatus(
  id: string,
  bloomLevel: ILO["bloomLevel"],
  statement: string,
  overrides: Partial<IloStatus> = {},
): IloStatus {
  return {
    ilo: {
      id,
      courseId: "course-1",
      topicId: "topic-1",
      statement,
      bloomLevel,
      archived: false,
      version: 1,
    },
    achieved: false,
    achievementRate: 80,
    gapCount: 1,
    ...overrides,
  };
}

function makeGap(iloId: string, level: number, feedbackId: string): GapItem {
  return {
    iloId,
    expected: "e",
    actual: `Issue: "issue-${feedbackId}" (CLT: Intrinsic, RBT: Level ${level})`,
    severity: "medium",
    feedbackId,
  };
}

function makeFeedback(id: string, rawText: string): Feedback {
  return {
    id,
    sessionId: "s1",
    rawText,
    cleanedText: rawText,
    aspects: [],
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("rateToAccent", () => {
  it("maps 0% to red and 100% to emerald", () => {
    expect(rateToAccent(0).color).toBe("hsl(0, 75%, 45%)");
    expect(rateToAccent(100).color).toBe("hsl(142, 75%, 45%)");
  });

  it("maps 50% to the amber-green midpoint", () => {
    expect(rateToAccent(50).color).toBe("hsl(71, 75%, 45%)");
  });

  it("clamps out-of-range rates", () => {
    expect(rateToAccent(-10).color).toBe("hsl(0, 75%, 45%)");
    expect(rateToAccent(150).color).toBe("hsl(142, 75%, 45%)");
  });

  it("derives border and background tint from the same hue", () => {
    const accent = rateToAccent(60);
    expect(accent.borderColor).toBe("hsla(85, 75%, 45%, 0.55)");
    expect(accent.bgTint).toBe("hsla(85, 75%, 45%, 0.07)");
  });
});

describe("declareGoalLevels", () => {
  it("maps a bloom level to its RBT number", () => {
    expect(declareGoalLevels("Analyze")).toEqual([4]);
  });

  it("falls back to level 1 for unknown levels", () => {
    expect(declareGoalLevels("Nope")).toEqual([1]);
  });
});

describe("resolveCascade", () => {
  it("places a single goal at its level with cascade below", () => {
    expect(resolveCascade([4])).toEqual({
      placementLevel: 4,
      lowestGoal: 4,
      cascadeLevels: [1, 2, 3],
    });
  });

  it("places multi-goal ILOs at the highest level and cascades below the lowest", () => {
    expect(resolveCascade([2, 5])).toEqual({
      placementLevel: 5,
      lowestGoal: 2,
      cascadeLevels: [1],
    });
  });

  it("has no cascade for a level-1 goal", () => {
    expect(resolveCascade([1])).toEqual({ placementLevel: 1, lowestGoal: 1, cascadeLevels: [] });
  });
});

describe("computeOutOfScopeLevels", () => {
  it("returns levels above the max declared level", () => {
    expect(computeOutOfScopeLevels(4)).toEqual([5, 6]);
  });

  it("returns nothing when Create is declared", () => {
    expect(computeOutOfScopeLevels(6)).toEqual([]);
  });

  it("marks everything above Remember as out of scope", () => {
    expect(computeOutOfScopeLevels(1)).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("computeGoalSubRows / goalAccentRate", () => {
  const gaps: GapItem[] = [makeGap("a", 3, "f1"), makeGap("a", 5, "f2"), makeGap("a", 5, "f3")];

  it("computes per-goal gap counts and gap-derived percentages", () => {
    const rows = computeGoalSubRows([3, 5], gaps, "a");
    expect(rows).toEqual([
      { level: 3, gapCount: 1, percentage: 67 },
      { level: 5, gapCount: 2, percentage: 33 },
    ]);
  });

  it("reports 100% when the ILO has no per-level gaps", () => {
    expect(computeGoalSubRows([4], [], "a")).toEqual([{ level: 4, gapCount: 0, percentage: 100 }]);
  });

  it("uses the global rate for single-goal ILOs", () => {
    const rows = computeGoalSubRows([3], gaps, "a");
    expect(goalAccentRate(rows, 60)).toBe(60);
  });

  it("uses the worst goal level for multi-goal ILOs", () => {
    const rows = computeGoalSubRows([3, 5], gaps, "a");
    expect(goalAccentRate(rows, 60)).toBe(33);
  });
});

describe("pillForLevel", () => {
  it("marks levels with ILOs as goal", () => {
    expect(pillForLevel(1, true, 3)).toBe("goal");
  });

  it("marks in-scope levels without ILOs as scope", () => {
    expect(pillForLevel(2, false, 3)).toBe("scope");
  });

  it("marks levels above the max declared level as out of scope", () => {
    expect(pillForLevel(5, false, 3)).toBe("out-of-scope");
  });
});

describe("gap helpers", () => {
  const gaps: GapItem[] = [
    makeGap("a", 3, "f1"),
    makeGap("a", 3, "f1"), // duplicate feedbackId at the same level
    makeGap("a", 1, "f2"),
    makeGap("b", 3, "f3"),
  ];

  it("distinctGapsAtLevel dedupes by feedbackId", () => {
    const items = distinctGapsAtLevel(gaps, 3);
    expect(items.map((g) => g.feedbackId)).toEqual(["f1", "f3"]);
  });

  it("directGapsForIlo filters by ILO and level", () => {
    const items = directGapsForIlo(gaps, "a", 3);
    expect(items.map((g) => g.feedbackId)).toEqual(["f1"]);
  });

  it("formatGapLabel parses the issue and level", () => {
    expect(formatGapLabel('Issue: "procedural bottleneck" (CLT: Intrinsic, RBT: Level 3)')).toBe(
      "procedural bottleneck · Level 3",
    );
  });

  it("formatGapLabel falls back to the raw string", () => {
    expect(formatGapLabel("no level here")).toBe("no level here");
  });
});

describe("IloGapCard rendering", () => {
  const statuses: IloStatus[] = [
    makeStatus("ilo-1", "Remember", "Recall definitions", {
      achieved: true,
      achievementRate: 100,
      gapCount: 0,
    }),
    makeStatus("ilo-2", "Apply", "Apply the procedure", {
      achieved: false,
      achievementRate: 60,
      gapCount: 2,
    }),
  ];

  // ilo-2 (Apply, level 3): direct gap at 3, cascade gaps at 1 and 2, plus an
  // out-of-scope diagnostic at level 5. Max declared level is 3.
  const gaps: GapItem[] = [
    makeGap("ilo-2", 3, "f1"),
    makeGap("ilo-2", 1, "f2"),
    makeGap("ilo-2", 2, "f3"),
    makeGap("ilo-2", 5, "f4"),
  ];

  it("renders all six levels in linear order with nested connectors", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    const names = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
    const positions = names.map((name) => markup.indexOf(name));
    positions.forEach((pos) => expect(pos).toBeGreaterThan(-1));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
    // One nesting connector per level boundary (5 boundaries between 6 levels).
    expect(markup.match(/border-l-2 border-border\/60/g)).toHaveLength(5);
  });

  it("labels levels with goal, scope, and out-of-scope pills", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    // Levels 1 and 3 hold ILOs; level 2 is in-scope without an ILO; 4-6 are out of scope.
    expect(markup.match(/>Goal</g)).toHaveLength(2);
    expect(markup.match(/>Scope</g)).toHaveLength(1);
    expect(markup.match(/>Out of scope</g)).toHaveLength(3);
  });

  it("places each ILO under its declared level and shows cascade pills", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    const applyHeader = markup.indexOf("Apply");
    const analyzeHeader = markup.indexOf("Analyze");
    const ilo2 = markup.indexOf("Apply the procedure");
    expect(ilo2).toBeGreaterThan(applyHeader);
    expect(ilo2).toBeLessThan(analyzeHeader);
    expect(markup).toContain("Cascades from");
    expect(markup).toContain("Remember · 1 gap");
    expect(markup).toContain("Understand · 1 gap");
  });

  it("shows cascade pills only for levels that actually have gaps", () => {
    // ilo-x (Apply, level 3) has gaps at levels 1 and 3, but none at level 2.
    const statusesX = [
      makeStatus("ilo-x", "Apply", "Apply the rule", { achievementRate: 70, gapCount: 2 }),
    ];
    const gapsX = [makeGap("ilo-x", 1, "fb"), makeGap("ilo-x", 3, "fd")];
    const markup = renderToStaticMarkup(<IloGapCard statuses={statusesX} gaps={gapsX} />);
    expect(markup).toContain("Cascades from");
    expect(markup).toContain("Remember · 1 gap");
    expect(markup).not.toContain("Understand · 1 gap");
  });

  it("omits the cascades block when no cascade level has gaps", () => {
    // ilo-y (Apply, level 3) has only a direct gap at its own level.
    const statusesY = [
      makeStatus("ilo-y", "Apply", "Apply the rule", { achievementRate: 70, gapCount: 1 }),
    ];
    const gapsY = [makeGap("ilo-y", 3, "fd")];
    const markup = renderToStaticMarkup(<IloGapCard statuses={statusesY} gaps={gapsY} />);
    expect(markup).not.toContain("Cascades from");
  });

  it("removes the ILO Level badge from cards", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    expect(markup).not.toContain("ILO Level");
  });

  it("renders plain-text stats with destructive gaps and dynamic achieved color", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    expect(markup).toContain("0 feedback gaps");
    expect(markup).toContain("2 feedback gaps");
    expect(markup).toContain("100% achieved");
    expect(markup).toContain("60% achieved");
    // ilo-2 has gaps -> destructive; ilo-1 has none -> plain muted.
    expect(markup).toContain("text-destructive");
    expect(markup).toContain("hsl(85, 75%, 45%)");
    expect(markup).toContain("hsl(142, 75%, 45%)");
  });

  it("renders level cards on in-scope levels without ILOs", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    // Level 2 (scope) has no ILO but does have gaps.
    expect(markup).toContain("1 feedback gap");
    expect(markup).toContain("at Understand");
    expect(markup).toContain("border-secondary/60");
  });

  it("renders out-of-scope levels as headers only, ignoring gaps", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    // Level 5 has a gap fixture but is out of scope: header only, no card.
    expect(markup).toContain("Evaluate");
    expect(markup).not.toContain("at Evaluate");
    expect(markup).not.toContain("opacity-70");
  });

  it("shows collapsed feedback toggles with direct and level quotes", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    expect(markup).toContain("Show 1 direct feedback quote");
    // Only the level-2 scope card shows a level quote; out-of-scope levels have none.
    expect(markup.match(/Show 1 feedback quote/g)).toHaveLength(1);
    // Lists are collapsed by default.
    expect(markup).not.toContain("issue-f1");
  });

  it("de-emphasizes out-of-scope level headers with an indicator", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    expect(markup.match(/Out of scope/g)).toHaveLength(3);
    expect(markup).toContain("opacity-60");
  });

  it("does not render per-ILO out-of-scope badge lists", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    expect(markup.match(/Out of scope/g)).toHaveLength(3);
    const firstCard = markup.indexOf("Recall definitions");
    const secondCard = markup.indexOf("Apply the procedure");
    expect(markup.slice(firstCard, secondCard)).not.toContain("Out of scope");
  });

  it("applies the continuous accent to card borders and text", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={statuses} gaps={gaps} />);
    expect(markup).toContain("hsl(142, 75%, 45%)");
    expect(markup).toContain("hsla(85, 75%, 45%, 0.55)");
  });

  it("renders the empty state", () => {
    const markup = renderToStaticMarkup(<IloGapCard statuses={[]} />);
    expect(markup).toContain("No ILOs defined for selected topic.");
  });
});

describe("GapFeedbackList", () => {
  const items = [makeGap("a", 3, "f1")];

  it("renders real student quotes when feedback is provided", () => {
    const feedback = new Map([["f1", makeFeedback("f1", "Students struggled to apply the rule.")]]);
    const markup = renderToStaticMarkup(<GapFeedbackList items={items} feedback={feedback} />);
    expect(markup).toContain("\u201cStudents struggled to apply the rule.\u201d");
  });

  it("falls back to the parsed issue label without feedback", () => {
    const markup = renderToStaticMarkup(<GapFeedbackList items={items} />);
    expect(markup).toContain("\u201cissue-f1 · Level 3\u201d");
  });
});
