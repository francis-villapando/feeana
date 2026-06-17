// Module 4: Pedagogical Diagnostic Mapping
// Maps extracted issues to TTI, RBT, and CLT pedagogic categories.

import type { CltCategory } from "./types";
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
