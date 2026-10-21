import { describe, it, expect } from "vitest";
import {
  GeneratePedagogicalCue,
  CalculateDistributions,
} from "../../lib/algorithm/strategyGeneration";
import { ISSUE_RULES, RBT_LEVELS } from "../../lib/algorithm/rules";
import { PRIORITY_THRESHOLD } from "../../lib/algorithm/constants";
import type {
  BufferedDiagnostic,
  DiagnosticRecord,
  RecommendationItem,
  SessionContext,
} from "../../lib/algorithm/types";

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
      primaryCandidates.push({
        item: uniqueIssue,
        score: priorityScore,
        weight: weightedCoefficient,
      });
    } else {
      subThresholdCandidates.push({
        item: uniqueIssue,
        score: priorityScore,
        weight: weightedCoefficient,
      });
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
        "warning",
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
          "warning",
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
  it("generates primary recommendation when issue crosses the priority threshold (>=30%)", () => {
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

    // The paragraph and term text show raw prevalence; the tooltip explains why it was picked.
    expect(recommendationList[0].paragraph).toContain("A total of 40% of the class");
    const primaryPrevalence = recommendationList[0].terms.find((t) => t.kind === "prevalence");
    expect(primaryPrevalence?.text).toBe("40%");
    expect(primaryPrevalence?.detail).toContain(
      "4 out of 10 responses mentioned this (40% of the class).",
    );
    expect(primaryPrevalence?.detail).toContain("meets the 30% mark");
    expect(primaryPrevalence?.detail).not.toContain("counts for more");

    expect(warningList.length).toBe(1);
    expect(warningList[0].issue).toBe("peer distraction");
    expect(warningList[0].tier).toBeUndefined();
    expect(warningList[0].terms.find((t) => t.kind === "prevalence")?.detail).toContain(
      "heads-up to monitor",
    );
  });

  it("treats an exactly-threshold issue as primary and says it meets the mark", () => {
    // 10 feedbacks: 3 clarity deficit (exactly 30%, non-gap), 1 peer distraction (10%)
    const buffer: DiagnosticRecord[] = [
      ...Array(3).fill({
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

    const { recommendationList } = runStrategyGenerationMock(buffer, 10, mockContext);

    expect(recommendationList.length).toBe(1);
    expect(recommendationList[0].issue).toBe("clarity deficit");
    expect(recommendationList[0].tier).toBe("primary");
    const detail = recommendationList[0].terms.find((t) => t.kind === "prevalence")?.detail;
    expect(detail).toContain("meets the 30% mark");
    expect(detail).not.toContain("above");
  });

  it("reports a gap issue that only meets the threshold via its boost as primary", () => {
    // 25 feedbacks: 5 notation struggle gap (raw 20%, boosted 30%), 1 peer distraction (4%)
    const buffer: DiagnosticRecord[] = [
      ...Array(5).fill({
        issue: "notation struggle",
        tti: "Language Modeling",
        rbt: 1,
        clt: "Intrinsic" as const,
        polarity: "neg" as const,
        isGap: true,
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

    const { recommendationList } = runStrategyGenerationMock(buffer, 25, mockContext);

    expect(recommendationList.length).toBe(1);
    expect(recommendationList[0].issue).toBe("notation struggle");
    expect(recommendationList[0].tier).toBe("primary");
    expect(recommendationList[0].paragraph).toContain("A total of 20% of the class");
    const detail = recommendationList[0].terms.find((t) => t.kind === "prevalence")?.detail;
    expect(detail).toContain("counts for more — 30%.");
    expect(detail).toContain("meets the 30% mark");
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
    expect(recommendationList[0].paragraph).toContain("A total of 20% of the class");
    const secondaryPrevalence = recommendationList[0].terms.find((t) => t.kind === "prevalence");
    expect(secondaryPrevalence?.text).toBe("20%");
    expect(secondaryPrevalence?.detail).toContain(
      "2 out of 10 responses mentioned this (20% of the class).",
    );
    expect(secondaryPrevalence?.detail).toContain("offered as a secondary cue");

    // Remaining lower-frequency sub-threshold issue stays in warnings
    expect(warningList.length).toBe(1);
    expect(warningList[0].issue).toBe("peer distraction");
    expect(warningList[0].tier).toBeUndefined();
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
    expect(warningList[0].tier).toBeUndefined();
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

    // Paragraph keeps the raw 10% prevalence; the tooltip is where the 15% boost is explained.
    expect(recommendationList[0].paragraph).toContain("A total of 10% of the class");
    const gapPrevalence = recommendationList[0].terms.find((t) => t.kind === "prevalence");
    expect(gapPrevalence?.text).toBe("10%");
    expect(gapPrevalence?.detail).toContain(
      "5 out of 50 responses mentioned this (10% of the class).",
    );
    expect(gapPrevalence?.detail).toContain("counts for more — 15%.");

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

    // The gap-boosted issue reports its raw 8% in the paragraph and the 12% boost only in the tooltip.
    const notation = recommendationList.find((r) => r.issue === "notation struggle");
    expect(notation?.paragraph).toContain("A total of 8% of the class");
    const notationPrevalence = notation?.terms.find((t) => t.kind === "prevalence");
    expect(notationPrevalence?.text).toBe("8%");
    expect(notationPrevalence?.detail).toContain("counts for more — 12%.");

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

  it("formats cue with updated issue tag, definition, and recommendation", () => {
    const cue = GeneratePedagogicalCue(
      mockContext,
      {
        issue: "relational coldness",
        tti: "Positive Climate",
        rbt: 1,
        clt: "Extraneous",
        polarity: "neg",
        isGap: false,
        count: 4,
      },
      10,
      1.0,
      "primary",
    );

    expect(cue.paragraph).toContain(
      "experiencing distant teacher issue under the positive climate aspect",
    );
    expect(cue.paragraph).toContain(
      "It is recommended to set up places where students can talk and connect, such as open forums, to start the lesson with a short icebreaker, and to use friendly, positive words so the class feels welcome.",
    );

    const issueTerm = cue.terms.find((t) => t.kind === "issue");
    expect(issueTerm?.text).toBe("Distant Teacher");
    expect(issueTerm?.detail).toBe(
      "Students feel the teacher does not connect with them. They see little warmth or respect between the teacher and the class.",
    );
  });

  it("formats peer distraction cue with updated recommendation phrasing", () => {
    const cue = GeneratePedagogicalCue(
      mockContext,
      {
        issue: "peer distraction",
        tti: "Behavior Management",
        rbt: 1,
        clt: "Extraneous",
        polarity: "neg",
        isGap: false,
        count: 4,
      },
      10,
      1.0,
      "primary",
    );

    expect(cue.paragraph).toContain(
      "It is recommended to set clear class rules and apply them consistently, and to use interesting activities, light humor, and relatable questions to bring students’ attention back to their studies.",
    );

    const recTerm = cue.terms.find((t) => t.kind === "recommendation");
    expect(recTerm?.text).toBe(
      "It is recommended to set clear class rules and apply them consistently, and to use interesting activities, light humor, and relatable questions to bring students’ attention back to their studies.",
    );
  });
});
