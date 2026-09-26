// Module 6: Dashboard Output
// Formats pipeline results into the final UI payload.

import type { RecommendationItem, StrategyStats, DiagnosticRecord } from "./types";
import type {
  AnalysisResult,
  DistEntry,
  GapItem,
  RecommendationTerm,
  Theory,
} from "../types/types";
import { ISSUE_RULES, RBT_LEVELS } from "./rules";

const BLOOM_LEVEL_MAP: Record<string, number> = {
  Remember: 1,
  Understand: 2,
  Apply: 3,
  Analyze: 4,
  Evaluate: 5,
  Create: 6,
};

interface IloLike {
  id: string;
  statement: string;
  bloomLevel?: string;
  bloom_level?: string;
}

export function getIloLevel(ilo: IloLike | undefined): number {
  if (!ilo) return 1;
  const bloomLevel = ilo.bloomLevel ?? ilo.bloom_level;
  return bloomLevel ? (BLOOM_LEVEL_MAP[bloomLevel] ?? 1) : 1;
}

export function buildIloGapItems(diagnostics: DiagnosticRecord[], ilos: IloLike[]): GapItem[] {
  if (diagnostics.length === 0 || ilos.length === 0) {
    return [];
  }

  return diagnostics
    .filter((diagnostic) => diagnostic.isGap)
    .flatMap((diagnostic) => {
      const issueLevel = diagnostic.rbt;

      return ilos
        .filter((ilo) => getIloLevel(ilo) >= issueLevel)
        .map((ilo) => ({
          iloId: ilo.id,
          expected: ilo.statement,
          actual: `Issue: "${diagnostic.issue}" (CLT: ${diagnostic.clt}, RBT: Level ${diagnostic.rbt})`,
          severity: "medium" as const,
          feedbackId: diagnostic.feedbackId,
        }));
    });
}

export interface AnalysisResultInput {
  sessionId: string;
  totalFeedback: number;
  stats: StrategyStats;
  buffer: DiagnosticRecord[];
  ilos: IloLike[];
  recommendationList: RecommendationItem[];
  warningList: RecommendationItem[];
  /** Normalized id → raw text. Callers differ in field name (`rawText` vs `content`). */
  feedback: Array<{ id: string; text: string }>;
}

/**
 * Assembles the Module 6 AnalysisResult. Single source of truth for both the
 * production pipeline and the seed path, so a seeded dashboard cannot silently
 * diverge from a computed one.
 */
export function buildAnalysisResult(input: AnalysisResultInput): AnalysisResult {
  const {
    sessionId,
    totalFeedback,
    stats,
    buffer,
    ilos,
    recommendationList,
    warningList,
    feedback,
  } = input;

  const aspectDist: DistEntry[] = Object.entries(stats.aspectCounts)
    .map(([label, value]) => ({ label, value }) as DistEntry)
    .sort((a, b) => b.value - a.value);

  const issueDist: DistEntry[] = Object.entries(stats.issueCounts)
    .map(([key, value]) => ({ label: ISSUE_RULES[key.toLowerCase()] ?? key, value }) as DistEntry)
    .sort((a, b) => b.value - a.value);

  const polarityDist: DistEntry[] = [
    { label: "Positive", value: stats.polarityCounts.pos || 0 },
    { label: "Neutral", value: stats.polarityCounts.neu || 0 },
    { label: "Negative", value: stats.polarityCounts.neg || 0 },
  ];

  const rbtDist: DistEntry[] = Object.entries(stats.rbtCounts)
    .map(([label, value]) => ({ label, value }) as DistEntry)
    .sort(
      (a, b) =>
        (RBT_LEVELS as readonly string[]).indexOf(a.label) -
        (RBT_LEVELS as readonly string[]).indexOf(b.label),
    );

  const cltDist: DistEntry[] = Object.entries(stats.cltCounts)
    .map(([label, value]) => ({ label, value }) as DistEntry)
    .sort((a, b) => b.value - a.value);

  // Enrich distribution entries with contributing feedback texts
  const feedbackMap = new Map<string, string>();
  for (const fb of feedback) feedbackMap.set(fb.id, fb.text);

  const aspectToTexts = new Map<string, string[]>();
  const issueToTexts = new Map<string, string[]>();
  const polarityToTexts: Record<string, string[]> = { pos: [], neu: [], neg: [] };
  const rbtToTexts = new Map<string, string[]>();
  const cltToTexts = new Map<string, string[]>();

  for (const diag of buffer) {
    const text = feedbackMap.get(diag.feedbackId ?? "");
    if (!text) continue;

    const aspectList = aspectToTexts.get(diag.tti) ?? [];
    aspectList.push(text);
    aspectToTexts.set(diag.tti, aspectList);

    const issueLabel = ISSUE_RULES[diag.issue.toLowerCase()] ?? diag.issue;
    const issueList = issueToTexts.get(issueLabel) ?? [];
    issueList.push(text);
    issueToTexts.set(issueLabel, issueList);

    if (diag.polarity in polarityToTexts) {
      polarityToTexts[diag.polarity].push(text);
    }

    const rbtName =
      diag.issue === "Uncategorized" ? "Uncategorized" : (RBT_LEVELS[diag.rbt] ?? String(diag.rbt));
    const rbtList = rbtToTexts.get(rbtName) ?? [];
    rbtList.push(text);
    rbtToTexts.set(rbtName, rbtList);

    const cltLabel = diag.issue === "Uncategorized" ? "Uncategorized" : diag.clt;
    const cltList = cltToTexts.get(cltLabel) ?? [];
    cltList.push(text);
    cltToTexts.set(cltLabel, cltList);
  }

  for (const entry of aspectDist) entry.feedbackTexts = aspectToTexts.get(entry.label);
  for (const entry of issueDist) entry.feedbackTexts = issueToTexts.get(entry.label);
  const polarityLabelKey: Record<string, string> = {
    Positive: "pos",
    Neutral: "neu",
    Negative: "neg",
  };
  for (const entry of polarityDist)
    entry.feedbackTexts = polarityToTexts[polarityLabelKey[entry.label]];
  for (const entry of rbtDist) entry.feedbackTexts = rbtToTexts.get(entry.label);
  for (const entry of cltDist) entry.feedbackTexts = cltToTexts.get(entry.label);

  // Gap items follow the RBT cascade rule: a diagnostic at level N flags ILOs at level N or above.
  const gaps = buildIloGapItems(buffer, ilos);

  return {
    sessionId,
    totalFeedback,
    aspectDist,
    issueDist,
    polarityDist,
    rbtDist,
    cltDist,
    gaps,
    diagnostics: buffer,
    recommendations: recommendationList.map((r) => {
      const issueLabel = ISSUE_RULES[r.issue.toLowerCase()] ?? r.issue;
      return {
        id: r.id,
        paragraph: r.paragraph,
        terms: r.terms as RecommendationTerm[],
        theories: r.theories as Theory[],
        priority: r.priority,
        feedbackTexts: issueToTexts.get(issueLabel),
        tier: r.tier,
      };
    }),
    warnings: warningList.map((recommendationItem) => ({
      id: recommendationItem.id,
      issue: recommendationItem.issue,
      terms: recommendationItem.terms as RecommendationTerm[],
      theories: recommendationItem.theories as Theory[],
      priority: recommendationItem.priority,
      count: recommendationItem.priority,
      isGap: recommendationItem.isGap,
    })),
  };
}
