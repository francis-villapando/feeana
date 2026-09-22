import { describe, it, expect } from "vitest";
import { GeneratePedagogicalCue, CalculateDistributions } from "../../lib/algorithm/strategyGeneration";
import { ISSUE_RULES, RBT_LEVELS } from "../../lib/algorithm/rules";
import type {
  BufferedDiagnostic,
  DiagnosticRecord,
  RecommendationItem,
  SessionContext,
} from "../../lib/algorithm/types";

const PRIORITY_THRESHOLD = 0.3;

function runStrategyGenerationMock(
  buffer: DiagnosticRecord[],
  totalFeedback: number,
  sessionContext: SessionContext,
) {
  const uniqueIssueMap = new Map<string, BufferedDiagnostic>();
  for (const diag of buffer) {
    const key = diag.issue.toLowerCase();
    const existing = uniqueIssueMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      uniqueIssueMap.set(key, { ...diag, count: 1 });
    }
  }

  const recommendationList: RecommendationItem[] = [];
  const warningList: RecommendationItem[] = [];

  const candidateIssues = Array.from(uniqueIssueMap.values()).filter(
    (item) => item.issue !== "Uncategorized" && item.count > 0,
  );

  const primaryCandidates: { item: BufferedDiagnostic; score: number; weight: number }[] = [];
  const subThresholdCandidates: { item: BufferedDiagnostic; score: number; weight: number }[] = [];

  for (const uniqueIssue of candidateIssues) {
    const weightedCoefficient = uniqueIssue.isGap ? 1.5 : 1.0;
    const priorityScore = (uniqueIssue.count / totalFeedback) * weightedCoefficient;

    if (priorityScore >= PRIORITY_THRESHOLD) {
      primaryCandidates.push({ item: uniqueIssue, score: priorityScore, weight: weightedCoefficient });
    } else {
      subThresholdCandidates.push({ item: uniqueIssue, score: priorityScore, weight: weightedCoefficient });
    }
  }

  if (primaryCandidates.length > 0) {
    for (const cand of primaryCandidates) {
      const cue = GeneratePedagogicalCue(
        sessionContext,
        cand.item,
        totalFeedback,
        cand.weight,
        "primary",
      );
      recommendationList.push(cue);
    }
    for (const cand of subThresholdCandidates) {
      const cue = GeneratePedagogicalCue(
        sessionContext,
        cand.item,
        totalFeedback,
        cand.weight,
        "primary",
      );
      warningList.push(cue);
    }
  } else if (subThresholdCandidates.length > 0) {
    // Promote the sub-threshold issue(s) with the highest boost-adjusted score; ties all go to secondary.
    const maxScore = Math.max(...subThresholdCandidates.map((c) => c.score));
    for (const cand of subThresholdCandidates) {
      if (Math.abs(cand.score - maxScore) < 1e-9) {
        const cue = GeneratePedagogicalCue(
          sessionContext,
          cand.item,
          totalFeedback,
          cand.weight,
          "secondary",
        );
        recommendationList.push(cue);
      } else {
        const cue = GeneratePedagogicalCue(
          sessionContext,
          cand.item,
          totalFeedback,
          cand.weight,
          "primary",
        );
        warningList.push(cue);
      }
    }
  }

  return { recommendationList, warningList };
}

const mockContext: SessionContext = {
  course: "CS 101",
  topic: "Recursion",
  targetIloRbt: 3,
  iloStatement: "Understand recursion principles",
};

describe("Pipeline Strategy: Primary vs. Secondary Tier Resolution & Tie Accommodating Fallback", () => {
  it("generates primary recommendation when issue crosses PRIMARY_PRIORITY_THRESHOLD (>=31%)", () => {
    // 10 feedbacks: 4 clarity deficit (40%), 2 peer distraction (20%)
    const buffer: DiagnosticRecord[] = [
      ...Array(4).fill({
        issue: "clarity deficit",
        tti: "Instructional Learning Formats",
        rbt: 2,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      }),
      ...Array(2).fill({
        issue: "peer distraction",
        tti: "Behavior Management",
        rbt: 1,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      }),
    ];

    const { recommendationList, warningList } = runStrategyGenerationMock(buffer, 10, mockContext);

    expect(recommendationList.length).toBe(1);
    expect(recommendationList[0].issue).toBe("clarity deficit");
    expect(recommendationList[0].tier).toBe("primary");

    expect(warningList.length).toBe(1);
    expect(warningList[0].issue).toBe("peer distraction");
  });

  it("generates secondary recommendation when all issues are below threshold, picking the most prevalent", () => {
    // 10 feedbacks: 2 clarity deficit (20%), 1 peer distraction (10%)
    const buffer: DiagnosticRecord[] = [
      ...Array(2).fill({
        issue: "clarity deficit",
        tti: "Instructional Learning Formats",
        rbt: 2,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      }),
      {
        issue: "peer distraction",
        tti: "Behavior Management",
        rbt: 1,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      },
    ];

    const { recommendationList, warningList } = runStrategyGenerationMock(buffer, 10, mockContext);

    expect(recommendationList.length).toBe(1);
    expect(recommendationList[0].issue).toBe("clarity deficit");
    expect(recommendationList[0].tier).toBe("secondary");
    expect(recommendationList[0].terms.find((t) => t.kind === "prevalence")?.detail).toContain(
      "out of 10 responses",
    );

    // Remaining lower-frequency sub-threshold issue stays in warnings
    expect(warningList.length).toBe(1);
    expect(warningList[0].issue).toBe("peer distraction");
  });

  it("accommodates multi-way ties for secondary recommendations", () => {
    // 10 feedbacks: 2 clarity deficit (20%), 2 peer distraction (20%), 1 instructional cadence (10%)
    const buffer: DiagnosticRecord[] = [
      ...Array(2).fill({
        issue: "clarity deficit",
        tti: "Instructional Learning Formats",
        rbt: 2,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      }),
      ...Array(2).fill({
        issue: "peer distraction",
        tti: "Behavior Management",
        rbt: 1,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      }),
      {
        issue: "instructional cadence",
        tti: "Productivity",
        rbt: 2,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      },
    ];

    const { recommendationList, warningList } = runStrategyGenerationMock(buffer, 10, mockContext);

    expect(recommendationList.length).toBe(2);
    const recIssues = recommendationList.map((r) => r.issue);
    expect(recIssues).toContain("clarity deficit");
    expect(recIssues).toContain("peer distraction");
    expect(recommendationList.every((r) => r.tier === "secondary")).toBe(true);

    // Neither tied issue should be in warningList
    expect(warningList.length).toBe(1);
    expect(warningList[0].issue).toBe("instructional cadence");
  });

  it("promotes a gap-boosted issue over a higher raw count when its boosted score is higher", () => {
    // 5/50 gap = 15% boosted outranks 7/50 = 14% non-gap despite lower raw count.
    const buffer: DiagnosticRecord[] = [
      ...Array(5).fill({
        issue: "notation struggle",
        tti: "Language Modeling",
        rbt: 1,
        clt: "Intrinsic" as const,
        polarity: "neg" as const,
        isGap: true,
      }),
      ...Array(7).fill({
        issue: "peer distraction",
        tti: "Behavior Management",
        rbt: 1,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      }),
    ];

    const { recommendationList, warningList } = runStrategyGenerationMock(buffer, 50, mockContext);

    expect(recommendationList.length).toBe(1);
    expect(recommendationList[0].issue).toBe("notation struggle");
    expect(recommendationList[0].tier).toBe("secondary");

    expect(warningList.length).toBe(1);
    expect(warningList[0].issue).toBe("peer distraction");
  });

  it("accommodates boosted-score ties between issues with different raw counts", () => {
    // 4/50 gap and 6/50 non-gap both hit 12% boosted, so both promote.
    const buffer: DiagnosticRecord[] = [
      ...Array(4).fill({
        issue: "notation struggle",
        tti: "Language Modeling",
        rbt: 1,
        clt: "Intrinsic" as const,
        polarity: "neg" as const,
        isGap: true,
      }),
      ...Array(6).fill({
        issue: "peer distraction",
        tti: "Behavior Management",
        rbt: 1,
        clt: "Extraneous" as const,
        polarity: "neg" as const,
        isGap: false,
      }),
    ];

    const { recommendationList, warningList } = runStrategyGenerationMock(buffer, 50, mockContext);

    expect(recommendationList.length).toBe(2);
    const recIssues = recommendationList.map((r) => r.issue);
    expect(recIssues).toContain("notation struggle");
    expect(recIssues).toContain("peer distraction");
    expect(recommendationList.every((r) => r.tier === "secondary")).toBe(true);

    expect(warningList.length).toBe(0);
  });

  it("handles empty candidate issues cleanly (only Uncategorized or empty buffer)", () => {
    const buffer: DiagnosticRecord[] = [
      {
        issue: "Uncategorized",
        tti: "Uncategorized",
        rbt: 1,
        clt: "Extraneous" as const,
        polarity: "neu" as const,
        isGap: false,
      },
    ];

    const { recommendationList, warningList } = runStrategyGenerationMock(buffer, 1, mockContext);

    expect(recommendationList.length).toBe(0);
    expect(warningList.length).toBe(0);
  });
});
