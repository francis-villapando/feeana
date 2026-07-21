// Module 6: Dashboard Output
// Formats pipeline results into the final UI payload.

import type { PipelineOutput, RecommendationItem, StrategyStats, DiagnosticRecord } from "./types";
import type { GapItem } from "../types/types";

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

function getIloLevel(ilo: IloLike): number {
  const bloomLevel = ilo.bloomLevel ?? ilo.bloom_level;
  return bloomLevel ? (BLOOM_LEVEL_MAP[bloomLevel] ?? 1) : 1;
}

export function buildIloGapItems(diagnostics: DiagnosticRecord[], ilos: IloLike[]): GapItem[] {
  if (diagnostics.length === 0 || ilos.length === 0) {
    return [];
  }

  return diagnostics
    .filter((diagnostic) => diagnostic.isGap && diagnostic.clt === "Intrinsic")
    .flatMap((diagnostic) => {
      const issueLevel = diagnostic.rbt;

      return ilos
        .filter((ilo) => getIloLevel(ilo) >= issueLevel)
        .map((ilo) => ({
          iloId: ilo.id,
          expected: ilo.statement,
          actual: `Issue: "${diagnostic.issue}" (CLT: ${diagnostic.clt}, RBT: Level ${diagnostic.rbt})`,
          severity: "medium" as const,
        }));
    });
}

export function formatDashboardOutput(
  recommendationList: RecommendationItem[],
  warningList: RecommendationItem[],
  stats: StrategyStats,
): PipelineOutput {
  console.debug("[dashboardOutput] Formatting dashboard output", {
    recommendationCount: recommendationList.length,
    warningCount: warningList.length,
  });

  return {
    recommendationList,
    warningList,
    stats,
  };
}
