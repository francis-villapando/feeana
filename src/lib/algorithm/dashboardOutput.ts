/*
 * Module 6: Dashboard Output.
 * This file formats the pipeline results into the final UI payload.
 */

import type {
  PipelineOutput,
  RecommendationItem,
  WarningItem,
  StrategyStats,
} from "./types";

export function formatDashboardOutput(
  recommendationList: RecommendationItem[],
  warningList: WarningItem[],
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
