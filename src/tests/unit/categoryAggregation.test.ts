import { describe, expect, it } from "vitest";
import { CHART_COLORS, RBT_COLOR_ORDER, SPECIAL_COLORS } from "../../lib/constants/chartColors";
import {
  aggregateTopCategories,
  type DistributionDataKey,
  type DistributionPoint,
} from "../../components/faculty/charts/utils/categoryAggregation";

const COLOR_ORDER: [string, string][] = [
  ["Alpha", "var(--color-chart-1)"],
  ["Beta", "var(--color-chart-2)"],
  ["Gamma", "var(--color-chart-3)"],
];

const RBT_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

function makePoint(
  topic: string,
  dist: Record<string, number>,
  dataKey: DistributionDataKey = "aspectDist",
): DistributionPoint {
  const point: DistributionPoint = {
    topic,
    aspectDist: [],
    issueDist: [],
    rbtDist: [],
    cltDist: [],
  };
  point[dataKey] = Object.entries(dist).map(([label, value]) => ({ label, value }));
  return point;
}

describe("aggregateTopCategories", () => {
  it("renders every present label with exact per-session values and zero-fill", () => {
    const points = [
      makePoint("s1", { Alpha: 10, Beta: 8, Gamma: 5 }),
      makePoint("s2", { Alpha: 5, Gamma: 1 }),
    ];

    const { labels, chartData } = aggregateTopCategories(points, "aspectDist", COLOR_ORDER);

    expect(labels).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(chartData[0]).toEqual({ topic: "s1", Alpha: 10, Beta: 8, Gamma: 5 });
    expect(chartData[1]).toEqual({ topic: "s2", Alpha: 5, Beta: 0, Gamma: 1 });
  });

  it("includes Uncategorized as its own series when present", () => {
    const points = [makePoint("s1", { Alpha: 5, Uncategorized: 2 })];

    const { labels, colorMap, chartData } = aggregateTopCategories(
      points,
      "aspectDist",
      COLOR_ORDER,
    );

    expect(labels).toEqual(["Alpha", "Uncategorized"]);
    expect(colorMap["Uncategorized"]).toBe(SPECIAL_COLORS["Uncategorized"]);
    expect(chartData[0]).toEqual({ topic: "s1", Alpha: 5, Uncategorized: 2 });
  });

  it("never emits an Other bucket", () => {
    const points = [
      makePoint("s1", { Alpha: 10, Beta: 8, Gamma: 5, Delta: 3, Epsilon: 2 }),
      makePoint("s2", { Alpha: 5, Beta: 2, Gamma: 1, Delta: 1, Epsilon: 1 }),
    ];

    const { labels, colorMap, chartData } = aggregateTopCategories(
      points,
      "aspectDist",
      COLOR_ORDER,
    );

    expect(labels).not.toContain("Other");
    expect(colorMap["Other"]).toBeUndefined();
    for (const row of chartData) {
      expect(row["Other"]).toBeUndefined();
    }
  });

  it("always renders the full canonical RBT set, zero-filling absent levels", () => {
    const points = [
      makePoint("s1", { Analyze: 6, Evaluate: 2 }, "rbtDist"),
      makePoint("s2", { Remember: 4, Create: 1 }, "rbtDist"),
    ];

    const { labels, chartData } = aggregateTopCategories(
      points,
      "rbtDist",
      RBT_COLOR_ORDER,
      RBT_LEVELS,
    );

    expect(labels).toEqual(RBT_LEVELS);
    expect(chartData[0]).toEqual({
      topic: "s1",
      Remember: 0,
      Understand: 0,
      Apply: 0,
      Analyze: 6,
      Evaluate: 2,
      Create: 0,
    });
    expect(chartData[1]).toEqual({
      topic: "s2",
      Remember: 4,
      Understand: 0,
      Apply: 0,
      Analyze: 0,
      Evaluate: 0,
      Create: 1,
    });
  });

  it("always renders Intrinsic and Extraneous for CLT", () => {
    const points = [makePoint("s1", { Intrinsic: 7 }, "cltDist")];

    const { labels, chartData } = aggregateTopCategories(points, "cltDist", COLOR_ORDER, [
      "Intrinsic",
      "Extraneous",
    ]);

    expect(labels).toEqual(["Intrinsic", "Extraneous"]);
    expect(chartData[0]).toEqual({ topic: "s1", Intrinsic: 7, Extraneous: 0 });
  });

  it("preserves known colors and falls back to SPECIAL_COLORS then CHART_COLORS", () => {
    const points = [
      makePoint("s1", { Alpha: 1, Beta: 1, Gamma: 1, Uncategorized: 5, Mystery: 3, Oddball: 2 }),
    ];

    const { colorMap } = aggregateTopCategories(points, "aspectDist", COLOR_ORDER);

    expect(colorMap["Alpha"]).toBe("var(--color-chart-1)");
    expect(colorMap["Beta"]).toBe("var(--color-chart-2)");
    expect(colorMap["Gamma"]).toBe("var(--color-chart-3)");
    expect(colorMap["Uncategorized"]).toBe(SPECIAL_COLORS["Uncategorized"]);
    expect(colorMap["Mystery"]).toBe(CHART_COLORS[0]);
    expect(colorMap["Oddball"]).toBe(CHART_COLORS[1]);
  });

  it("orders labels by the canonical color order", () => {
    const points = [makePoint("s1", { Alpha: 5, Beta: 5, Gamma: 5 })];

    const { labels } = aggregateTopCategories(points, "aspectDist", COLOR_ORDER);

    expect(labels).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("returns empty results for empty input", () => {
    const result = aggregateTopCategories([], "aspectDist", COLOR_ORDER);

    expect(result).toEqual({ labels: [], colorMap: {}, chartData: [] });
  });
});
