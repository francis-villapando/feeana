import { describe, expect, it } from "vitest";
import { buildIloGapItems, buildAnalysisResult } from "../../lib/algorithm/dashboardOutput";
import type {
  BufferedDiagnostic,
  DiagnosticRecord,
  RecommendationItem,
  StrategyStats,
} from "../../lib/algorithm/types";

describe("gap cascade logic", () => {
  it("flags ILOs at the same level or above the diagnostic RBT level", () => {
    const diagnostics: DiagnosticRecord[] = [
      {
        feedbackId: "fb-1",
        issue: "procedural bottleneck",
        polarity: "neg",
        tti: "Concept Development",
        rbt: 3,
        clt: "Intrinsic",
        isGap: true,
      },
    ];

    const ilos = [
      { id: "ilo-1", statement: "Apply the procedure", bloomLevel: "Apply" as const },
      { id: "ilo-2", statement: "Analyze the result", bloomLevel: "Analyze" as const },
      { id: "ilo-3", statement: "Recall the steps", bloomLevel: "Remember" as const },
    ];

    const gaps = buildIloGapItems(diagnostics, ilos);

    expect(gaps.map((gap) => gap.iloId)).toEqual(["ilo-1", "ilo-2"]);
    expect(gaps.every((gap) => gap.feedbackId === "fb-1")).toBe(true);
  });

  it("does not flag ILOs below the diagnostic RBT level", () => {
    const diagnostics: DiagnosticRecord[] = [
      {
        feedbackId: "fb-2",
        issue: "design synthesis failure",
        polarity: "neg",
        tti: "Concept Development",
        rbt: 6,
        clt: "Intrinsic",
        isGap: true,
      },
    ];

    const ilos = [
      { id: "ilo-1", statement: "Create a design", bloomLevel: "Create" as const },
      { id: "ilo-2", statement: "Evaluate a design", bloomLevel: "Evaluate" as const },
    ];

    const gaps = buildIloGapItems(diagnostics, ilos);

    expect(gaps.map((gap) => gap.iloId)).toEqual(["ilo-1"]);
    expect(gaps.every((gap) => gap.feedbackId === "fb-2")).toBe(true);
  });
});

describe("buildAnalysisResult", () => {
  const stats: StrategyStats = {
    totalFeedback: 2,
    issueCounts: { "concept development": 1, uncategorized: 1 },
    gapCount: 1,
    aspectCounts: { "Concept Development": 1, Resources: 1 },
    polarityCounts: { pos: 0, neu: 1, neg: 1 },
    rbtCounts: { Apply: 1, Remember: 1 },
    cltCounts: { Intrinsic: 1, Extraneous: 1 },
  };

  const buffer: BufferedDiagnostic[] = [
    {
      feedbackId: "fb-1",
      issue: "concept development",
      polarity: "neg",
      tti: "Concept Development",
      rbt: 3,
      clt: "Intrinsic",
      isGap: true,
      count: 1,
    },
    {
      feedbackId: "fb-2",
      issue: "uncategorized",
      polarity: "neu",
      tti: "Resources",
      rbt: 1,
      clt: "Extraneous",
      isGap: false,
      count: 1,
    },
  ];

  const recommendationList: RecommendationItem[] = [
    {
      id: "rec-1",
      issue: "concept development",
      paragraph: "para",
      terms: [],
      priority: 0.5,
      theories: [],
      isGap: true,
    },
  ];

  const warningList: RecommendationItem[] = [
    {
      id: "warn-1",
      issue: "uncategorized",
      paragraph: "para",
      terms: [],
      priority: 0.2,
      theories: [],
      isGap: false,
    },
  ];

  const base = {
    sessionId: "sess-1",
    totalFeedback: 2,
    stats,
    buffer,
    ilos: [{ id: "ilo-1", statement: "Apply it", bloomLevel: "Apply" }],
    recommendationList,
    warningList,
    feedback: [
      { id: "fb-1", text: "first text" },
      { id: "fb-2", text: "second text" },
    ],
  };

  it("carries session identity and the buffer through to diagnostics", () => {
    const result = buildAnalysisResult(base);

    expect(result.sessionId).toBe("sess-1");
    expect(result.totalFeedback).toBe(2);
    // The seed path previously omitted diagnostics, letting a seeded dashboard
    // diverge from a computed one. Both paths now populate it.
    expect(result.diagnostics).toEqual(buffer);
  });

  it("joins feedback texts onto distributions via feedbackId", () => {
    const result = buildAnalysisResult(base);

    const aspect = result.aspectDist.find((entry) => entry.label === "Concept Development");
    expect(aspect?.feedbackTexts).toEqual(["first text"]);

    const negative = result.polarityDist.find((entry) => entry.label === "Negative");
    expect(negative?.feedbackTexts).toEqual(["first text"]);

    const resources = result.aspectDist.find((entry) => entry.label === "Resources");
    expect(resources?.feedbackTexts).toEqual(["second text"]);
  });

  it("orders rbtDist by cognitive level and always emits the three polarity buckets", () => {
    const result = buildAnalysisResult(base);

    expect(result.rbtDist.map((entry) => entry.label)).toEqual(["Remember", "Apply"]);
    expect(result.polarityDist.map((entry) => entry.label)).toEqual([
      "Positive",
      "Neutral",
      "Negative",
    ]);
  });

  it("maps recommendations and warnings to their public shapes", () => {
    const result = buildAnalysisResult(base);

    expect(result.recommendations).toEqual([
      {
        id: "rec-1",
        paragraph: "para",
        terms: [],
        theories: [],
        priority: 0.5,
        feedbackTexts: ["first text"],
        tier: undefined,
      },
    ]);
    expect(result.warnings).toEqual([
      {
        id: "warn-1",
        issue: "uncategorized",
        terms: [],
        theories: [],
        priority: 0.2,
        count: 0.2,
        isGap: false,
      },
    ]);
  });

  it("returns empty distributions rather than throwing on an empty buffer", () => {
    const result = buildAnalysisResult({
      ...base,
      buffer: [],
      recommendationList: [],
      warningList: [],
      feedback: [],
    });

    expect(result.gaps).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.aspectDist.every((entry) => entry.feedbackTexts === undefined)).toBe(true);
  });
});
