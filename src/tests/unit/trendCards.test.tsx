import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CategoryTrendCard } from "../../components/faculty/charts/CategoryTrendCard";
import { MetricTrendCard } from "../../components/faculty/charts/MetricTrendCard";
import type { TrendPoint } from "../../lib/hooks/metrics";
import type { DistEntry } from "../../lib/types/types";

function dist(entries: [string, number][]): DistEntry[] {
  return entries.map(([label, value]) => ({ label, value }));
}

function makeTrendPoint(topic: string, overrides: Partial<TrendPoint> = {}): TrendPoint {
  return {
    topic,
    sessionId: `s-${topic}`,
    submissionRate: 80,
    iloAchievement: 70,
    avgPolarity: 0.4,
    recommendationCount: 3,
    warningCount: 1,
    aspectDist: dist([
      ["Clarity", 5],
      ["Pacing", 3],
    ]),
    issueDist: dist([["procedural bottleneck", 4]]),
    rbtDist: dist([
      ["Analyze", 6],
      ["Evaluate", 2],
    ]),
    cltDist: dist([
      ["Intrinsic", 7],
      ["Extraneous", 1],
    ]),
    ...overrides,
  };
}

describe("MetricTrendCard", () => {
  it("renders the card chrome with all three tabs", () => {
    const markup = renderToStaticMarkup(<MetricTrendCard trend={[]} />);
    expect(markup).toContain("Trend line");
    expect(markup).toContain("Engagement");
    expect(markup).toContain("Polarity");
    expect(markup).toContain("Issues");
    expect(markup).toContain("Submission rate and ILO achievement per analyzed session.");
  });

  it("shows the empty state when there is no trend data", () => {
    const markup = renderToStaticMarkup(<MetricTrendCard trend={[]} />);
    expect(markup).toContain(
      "Trend will appear after you trigger analysis on at least one session.",
    );
  });

  it("emits the engagement chart config when data is present", () => {
    const markup = renderToStaticMarkup(<MetricTrendCard trend={[makeTrendPoint("S1")]} />);
    expect(markup).toContain("--color-submissionRate");
    expect(markup).toContain("--color-iloAchievement");
  });
});

describe("CategoryTrendCard", () => {
  it("renders the card chrome with view tabs", () => {
    const markup = renderToStaticMarkup(<CategoryTrendCard trend={[]} />);
    expect(markup).toContain("Trend distribution");
    expect(markup).toContain("Aspect");
    expect(markup).toContain("Issue");
    expect(markup).toContain("RBT");
    expect(markup).toContain("CLT");
    expect(markup).toContain("Student concern areas per session.");
  });

  it("shows the empty state when no session has distribution data", () => {
    const trend = [makeTrendPoint("S1", { aspectDist: [] })];
    const markup = renderToStaticMarkup(<CategoryTrendCard trend={trend} />);
    expect(markup).toContain(
      "Trend will appear after you trigger analysis on at least one session.",
    );
  });

  it("rolls up dominant categories into the chart config", () => {
    const markup = renderToStaticMarkup(<CategoryTrendCard trend={[makeTrendPoint("S1")]} />);
    expect(markup).toContain("--color-Clarity");
    expect(markup).toContain("--color-Pacing");
    expect(markup).not.toContain("--color-Other");
  });

  it("renders every present category without an Other bucket", () => {
    const trend = [
      makeTrendPoint("S1", {
        aspectDist: dist([
          ["Cat1", 9],
          ["Cat2", 8],
          ["Cat3", 7],
          ["Cat4", 6],
          ["Cat5", 5],
          ["Cat6", 4],
          ["Cat7", 3],
        ]),
      }),
    ];
    const markup = renderToStaticMarkup(<CategoryTrendCard trend={trend} />);
    expect(markup).toContain("--color-Cat1");
    expect(markup).toContain("--color-Cat7");
    expect(markup).not.toContain("--color-Other");
  });
});
