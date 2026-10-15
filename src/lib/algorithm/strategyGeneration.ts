// Module 5: Strategy Generation — computes distributions, prioritizes issues, and generates pedagogical cues.

import {
  CLT_DESCRIPTIONS,
  ISSUE_DESCRIPTIONS,
  ISSUE_RECOMMENDATIONS,
  ISSUE_RULES,
  RBT_DESCRIPTIONS,
  RBT_LEVELS,
  TTI_DESCRIPTIONS,
} from "./rules";
import { PRIORITY_THRESHOLD } from "./constants";
import type {
  BufferedDiagnostic,
  DiagnosticRecord,
  StrategyStats,
  RecommendationItem,
  SessionContext,
  CueTier,
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
    rbtCounts: {},
    cltCounts: {},
  };

  for (const diag of buffer) {
    stats.issueCounts[diag.issue] = (stats.issueCounts[diag.issue] || 0) + 1;
    if (diag.isGap) stats.gapCount++;
    stats.aspectCounts[diag.tti] = (stats.aspectCounts[diag.tti] || 0) + 1;

    if (diag.polarity === "pos" || diag.polarity === "neu" || diag.polarity === "neg") {
      stats.polarityCounts[diag.polarity]++;
    }

    const rbtName =
      diag.issue === "Uncategorized" ? "Uncategorized" : (RBT_LEVELS[diag.rbt] ?? String(diag.rbt));
    stats.rbtCounts[rbtName] = (stats.rbtCounts[rbtName] || 0) + 1;

    const cltLabel = diag.issue === "Uncategorized" ? "Uncategorized" : diag.clt;
    stats.cltCounts[cltLabel] = (stats.cltCounts[cltLabel] || 0) + 1;
  }

  return stats;
}

function cleanStatement(text?: string | null): string {
  if (!text) return "";
  return text.trim().replace(/\.+$/, "");
}

interface ScopedIloItem {
  text: string;
  detail: string;
}

function scopeIloItems(sessionContext: SessionContext, rbtLevel: number): ScopedIloItem[] {
  const ilos = sessionContext.ilos;
  if (!ilos || ilos.length === 0) {
    const raw = cleanStatement(sessionContext.iloStatement);
    if (!raw) return [];
    const rbtLabel =
      RBT_LEVELS[sessionContext.targetIloRbt] ?? `Level ${sessionContext.targetIloRbt}`;
    const detail = `RBT Level ${sessionContext.targetIloRbt} · ${rbtLabel}`;
    if (raw.includes(";")) {
      return raw
        .split(";")
        .map((s) => cleanStatement(s))
        .filter(Boolean)
        .map((text) => ({ text, detail }));
    }
    return [{ text: raw, detail }];
  }

  const relevant = ilos.filter((ilo) => ilo.level >= rbtLevel);
  if (relevant.length === 0) {
    const raw = cleanStatement(sessionContext.iloStatement);
    const rbtLabel =
      RBT_LEVELS[sessionContext.targetIloRbt] ?? `Level ${sessionContext.targetIloRbt}`;
    return raw
      ? [{ text: raw, detail: `RBT Level ${sessionContext.targetIloRbt} · ${rbtLabel}` }]
      : [];
  }

  if (ilos.length === 1) {
    const ilo = relevant[0];
    const text = cleanStatement(ilo.statement);
    const rbtLabel = RBT_LEVELS[ilo.level] ?? `Level ${ilo.level}`;
    return [{ text, detail: `RBT Level ${ilo.level} · ${rbtLabel}` }];
  }

  return relevant.map((ilo) => {
    const text = `ILO ${ilo.index + 1}: ${cleanStatement(ilo.statement)}`;
    const rbtLabel = RBT_LEVELS[ilo.level] ?? `Level ${ilo.level}`;
    return {
      text,
      detail: `RBT Level ${ilo.level} · ${rbtLabel}`,
    };
  });
}

export function GeneratePedagogicalCue(
  sessionContext: SessionContext,
  uniqueIssue: BufferedDiagnostic,
  totalFeedback: number,
  weightedCoefficient: number,
  tier: CueTier = "primary",
): RecommendationItem {
  console.debug("[strategyGeneration] Generating pedagogical cue", {
    topic: sessionContext.topic,
    isGap: uniqueIssue.isGap,
    issue: uniqueIssue.issue,
    tier,
  });

  const prevalencePct = (uniqueIssue.count / totalFeedback) * 100;
  const prevalenceStr = `${prevalencePct.toFixed(0)}%`;
  const priorityScore = (uniqueIssue.count / totalFeedback) * weightedCoefficient;
  const boostedPctStr = `${(priorityScore * 100).toFixed(0)}%`;
  const thresholdPct = Math.round(PRIORITY_THRESHOLD * 100);
  const rbtName = RBT_LEVELS[uniqueIssue.rbt] ?? String(uniqueIssue.rbt);

  const rbtLower = rbtName.toLowerCase();
  const cltLower = uniqueIssue.clt.toLowerCase();
  const ttiLower = uniqueIssue.tti.toLowerCase();
  const displayIssue = ISSUE_RULES[uniqueIssue.issue.toLowerCase()] ?? uniqueIssue.issue;
  // The paragraph reads the issue name in lowercase; the term/tooltip keep the display casing.
  const displayIssueLower = displayIssue.toLowerCase();
  const recommendationSentence =
    ISSUE_RECOMMENDATIONS[uniqueIssue.issue] ??
    ISSUE_RECOMMENDATIONS[displayIssue] ??
    `Thus, "recommendation cue for ${displayIssue}."`;

  const scopedIlos = scopeIloItems(sessionContext, uniqueIssue.rbt);
  const goalStatement = scopedIlos.map((i) => i.text).join(" — ");
  const goalNoun = scopedIlos.length > 1 ? "goals" : "goal";

  const paragraph = uniqueIssue.isGap
    ? `A total of ${prevalenceStr} of the class is experiencing ${displayIssueLower} issue under the ${ttiLower} aspect in ${sessionContext.topic}. According to RBT, students are not achieving the ${rbtLower} level and hence they are not able to achieve the ${goalNoun}: ${goalStatement}. CLT identifies high ${cltLower} load as the cause. ${recommendationSentence}`
    : `A total of ${prevalenceStr} of the class is experiencing ${displayIssueLower} issue under the ${ttiLower} aspect in ${sessionContext.topic}. According to RBT, students are not achieving the ${rbtLower} level. CLT identifies high ${cltLower} load as the cause. ${recommendationSentence}`;

  // Skip the boost note when rounding hides it, so the tooltip never claims a boost it cannot show.
  const gapClause =
    uniqueIssue.isGap && boostedPctStr !== prevalenceStr
      ? ` Because it relates to a learning outcome students haven't reached, it counts for more — ${boostedPctStr}.`
      : "";

  let reason = ` That meets the ${thresholdPct}% mark, so it triggers a recommendation.`;
  if (tier === "secondary") {
    reason = ` It is among the most prominent of the remaining concerns but stays under the ${thresholdPct}% mark, so it is offered as a secondary cue.`;
  } else if (tier === "warning") {
    reason = ` It stays under the ${thresholdPct}% mark, so it is shared as a heads-up to monitor.`;
  }

  const prevalenceDetail = `${uniqueIssue.count} out of ${totalFeedback} responses mentioned this (${prevalenceStr} of the class).${gapClause}${reason}`;

  const terms = [
    {
      text: prevalenceStr,
      kind: "prevalence",
      detail: prevalenceDetail,
    },
    {
      text: displayIssue,
      kind: "issue",
      detail:
        ISSUE_DESCRIPTIONS[displayIssue] ?? ISSUE_DESCRIPTIONS[uniqueIssue.issue] ?? displayIssue,
    },
    {
      text: sessionContext.topic,
      kind: "topic",
      detail: `The session topic.`,
    },
    {
      text: uniqueIssue.tti,
      kind: "TTI",
      detail: TTI_DESCRIPTIONS[uniqueIssue.tti] ?? uniqueIssue.tti,
    },
    {
      text: rbtName,
      kind: "RBT",
      detail: RBT_DESCRIPTIONS[rbtName] ?? rbtName,
    },
    ...(uniqueIssue.isGap
      ? scopedIlos.map((ilo) => ({
        text: ilo.text,
        kind: "ILO" as const,
        detail: ilo.detail,
      }))
      : []),
    {
      text: uniqueIssue.clt,
      kind: "CLT",
      detail: CLT_DESCRIPTIONS[uniqueIssue.clt].definition,
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
    tier: tier === "warning" ? undefined : tier,
  };
}
