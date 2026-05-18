/*
 * Module 4: Pedagogical Diagnostic Mapping.
 * This file will map extracted issues to TTI, RBT, and CLT values.
 */

export function map_tti(issue: string): string {
  console.debug("[pedagogicalDiagnosticMapping] Mapping TTI", { issue });
  return "Unknown";
}

export function map_rbt(issue: string): number {
  console.debug("[pedagogicalDiagnosticMapping] Mapping RBT", { issue });
  return 1;
}

export function map_clt(issue: string): string {
  console.debug("[pedagogicalDiagnosticMapping] Mapping CLT", { issue });
  return "Intrinsic";
}
