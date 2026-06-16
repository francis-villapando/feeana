/*
 * Computes distributions and generates recommendations or warnings.
 */

import { ISSUE_DESCRIPTIONS, ISSUE_RECOMMENDATIONS, RBT_DESCRIPTIONS, RBT_LEVELS, TTI_DESCRIPTIONS } from "./rules";
import type {
  BufferedDiagnostic,
  DiagnosticRecord,
  StrategyStats,
  RecommendationItem,
  WarningItem,
  SessionContext,
} from "./types";

export function CalculateDistributions(
  buffer: DiagnosticRecord[],
  totalFeedback: number,
): StrategyStats {
  console.debug("[strategyGeneration] Calculating distributions", {
    totalFeedback,
    diagnosticCount: buffer.length,
  });

  const stats: StrategyStats = {
    totalFeedback,
    issueCounts: {},
    gapCount: 0,
    aspectCounts: {},
    polarityCounts: { pos: 0, neu: 0, neg: 0 },
  };

  for (const diag of buffer) {
    stats.issueCounts[diag.issue] = (stats.issueCounts[diag.issue] || 0) + 1;
    if (diag.isGap) stats.gapCount++;
    stats.aspectCounts[diag.tti] = (stats.aspectCounts[diag.tti] || 0) + 1;

    if (diag.polarity === "pos" || diag.polarity === "neu" || diag.polarity === "neg") {
      stats.polarityCounts[diag.polarity]++;
    }
  }

  return stats;
}

export function GeneratePedagogicalCue(
  sessionContext: SessionContext,
  uniqueIssue: BufferedDiagnostic,
  totalFeedback: number
): RecommendationItem {
  console.debug("[strategyGeneration] Generating pedagogical cue", {
    topic: sessionContext.topic,
    isGap: uniqueIssue.isGap,
    issue: uniqueIssue.issue,
  });

  const percentage = Math.round((uniqueIssue.count / totalFeedback) * 100);
  const percentageStr = `${percentage}%`;
  const rbtName = RBT_LEVELS[uniqueIssue.rbt] ?? String(uniqueIssue.rbt);

  const rbtLower = rbtName.toLowerCase();
  const cltLower = uniqueIssue.clt.toLowerCase();
  const ttiLower = uniqueIssue.tti.toLowerCase();
  const recommendationSentence = ISSUE_RECOMMENDATIONS[uniqueIssue.issue] ?? `Thus, "recommendation cue for ${uniqueIssue.issue}."`;

  const paragraph = uniqueIssue.isGap
    ? `A total of ${percentageStr} of the class is experiencing ${uniqueIssue.issue} under ${ttiLower} in ${sessionContext.topic}. According to RBT, students are not achieving the ${rbtLower} level and hence they are not able to achieve the goal: ${sessionContext.iloStatement}. CLT identifies high ${cltLower} load as the cause. ${recommendationSentence}`
    : `A total of ${percentageStr} of the class is experiencing ${uniqueIssue.issue} under ${ttiLower} in ${sessionContext.topic}. According to RBT, students are not achieving the ${rbtLower} level. CLT identifies high ${cltLower} load as the cause. ${recommendationSentence}`;

  const terms = [
    {
      text: percentageStr,
      kind: "metric",
      detail: `${uniqueIssue.count} out of ${totalFeedback} responses`,
    },
    {
      text: uniqueIssue.issue,
      kind: "issue",
      detail: ISSUE_DESCRIPTIONS[uniqueIssue.issue] ?? uniqueIssue.issue,
    },
    {
      text: sessionContext.topic,
      kind: "topic",
      detail: `The session topic.`,
    },
    {
      text: rbtName,
      kind: "RBT",
      detail: RBT_DESCRIPTIONS[rbtName] ?? rbtName,
    },
    {
      text: uniqueIssue.tti,
      kind: "TTI",
      detail: TTI_DESCRIPTIONS[uniqueIssue.tti] ?? uniqueIssue.tti,
    },
    ...(uniqueIssue.isGap
      ? [
        {
          text: sessionContext.iloStatement,
          kind: "ILO" as const,
          detail: sessionContext.iloStatement,
        },
      ]
      : []),
    {
      text: uniqueIssue.clt,
      kind: "CLT",
      detail: uniqueIssue.clt === "Intrinsic"
        ? "The inherent complexity of a task."
        : "The way in which instruction has been designed.",
    },
    {
      text: recommendationSentence,
      kind: "recommendation",
      detail: `Recommended pedagogical intervention for ${uniqueIssue.issue}.`,
    },
  ];

  return {
    id: `rec-${Math.random().toString(36).slice(2, 10)}`,
    issue: uniqueIssue.issue,
    paragraph,
    terms,
    priority: uniqueIssue.count,
    theories: ["RBT", "CLT"],
    isGap: uniqueIssue.isGap,
  };
}

export function GenerateDiagnosticWarning(
  uniqueIssue: BufferedDiagnostic,
): WarningItem {
  console.debug("[strategyGeneration] Generating diagnostic warning", {
    issue: uniqueIssue.issue,
  });

  return {
    id: `warn-${Math.random().toString(36).slice(2, 10)}`,
    issue: uniqueIssue.issue,
    count: uniqueIssue.count,
  };
}
