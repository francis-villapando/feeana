// Module 4: Pedagogical Diagnostic Mapping
// Maps extracted issues to TTI, RBT, and CLT pedagogic categories.

import type { CltCategory, DiagnosticRecord, Polarity } from "./types";
import { TTI_RULES, RBT_RULES, CLT_RULES } from "./rules";

export function map_tti(issue: string): string {
  console.debug("[pedagogicalDiagnosticMapping] Mapping TTI", { issue });
  return TTI_RULES[issue.toLowerCase()] || "Unknown";
}

export function map_rbt(issue: string): number {
  console.debug("[pedagogicalDiagnosticMapping] Mapping RBT", { issue });
  return RBT_RULES[issue.toLowerCase()] || 1;
}

export function map_clt(issue: string): CltCategory {
  console.debug("[pedagogicalDiagnosticMapping] Mapping CLT", { issue });
  return CLT_RULES[issue.toLowerCase()] || "Intrinsic";
}

export function buildDiagnosticRecord(
  issue: string,
  polarity: Polarity,
  targetIloRbt: number,
  feedbackId?: string,
): DiagnosticRecord {
  console.debug("[pedagogicalDiagnosticMapping] Building diagnostic record", {
    issue,
    polarity,
    targetIloRbt,
    feedbackId,
  });

  const tti = map_tti(issue);
  const rbt = map_rbt(issue);
  const clt = map_clt(issue);
  const isGap = issue !== "Uncategorized" && rbt <= targetIloRbt && clt === "Intrinsic";

  return {
    feedbackId,
    issue,
    polarity,
    tti,
    rbt,
    clt,
    isGap,
  };
}
