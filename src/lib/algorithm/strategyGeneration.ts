/*
 * Module 5: Strategy Generation.
 * This file will compute distributions and generate recommendations or warnings.
 */

import { RBT_LEVEL_NAMES } from "./rules";
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
  const rbtName = RBT_LEVEL_NAMES[uniqueIssue.rbt] ?? String(uniqueIssue.rbt);
  
  const paragraph = `${percentageStr} of the class is experiencing ${uniqueIssue.issue} with respect to ${sessionContext.topic}. According to RBT, students are not achieving the levels of ${rbtName} and hence they are not able to achieve the goal: ${sessionContext.iloStatement}. The cause of CLT is high ${uniqueIssue.clt} Load. Thus, "recommendation cue for ${uniqueIssue.issue}."`;

  const terms = [
    {
      text: percentageStr,
      kind: "metric",
      detail: `${percentageStr} of the class (${uniqueIssue.count} out of ${totalFeedback} responses)`,
    },
    {
      text: uniqueIssue.issue,
      kind: "issue",
      detail: `Detected issue in student feedback`,
    },
    {
      text: sessionContext.topic,
      kind: "aspect",
      detail: `The session topic`,
    },
    {
      text: rbtName,
      kind: "RBT",
      detail: `Level ${uniqueIssue.rbt} (${rbtName}) on Bloom's Taxonomy`,
    },
    {
      text: sessionContext.iloStatement,
      kind: "ILO",
      detail: sessionContext.iloStatement,
    },
    {
      text: uniqueIssue.clt,
      kind: "CLT",
      detail: uniqueIssue.clt === "Intrinsic"
        ? "Intrinsic Load — complexity inherent to the learning material"
        : "Extraneous Load — unnecessary cognitive burden from instruction design",
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
    warning: `Minor issue detected: ${uniqueIssue.issue}`,
    count: uniqueIssue.count,
  };
}
