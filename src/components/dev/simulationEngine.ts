/**
 * Algorithm Simulation engine — mirrors algorithm.pseudo (Modules 1-6) using the
 * REAL pipeline functions so the step-by-step simulator matches production output.
 *
 * Module 3 (Information Extraction) runs the real DistilXLM-R model via the shared
 * ML worker (extractSingle), which surfaces the model confidence.
 */

import { CleanFeedback } from "../../lib/algorithm/preprocess";
import { map_tti, map_rbt, map_clt } from "../../lib/algorithm/pedagogicalDiagnosticMapping";
import { GeneratePedagogicalCue } from "../../lib/algorithm/strategyGeneration";
import { RBT_LEVELS } from "../../lib/algorithm/rules";
import type { SessionContext, BufferedDiagnostic, RecommendationItem } from "../../lib/algorithm/types";

export type { RecommendationItem } from "../../lib/algorithm/types";

export const PRIORITY_THRESHOLD = 0.3;
export const GAP_WEIGHT = 1.5;
export const NON_GAP_WEIGHT = 1.0;

export interface SimulationInput {
  topic: string;
  iloStatement: string;
  targetRbt: number; // RBT_target, 1-6
  feedbackText: string;
  totalFeedback: number; // Total_F (simulated cohort size)
  issueOccurrences: number; // simulated count of the extracted issue in the cohort
}

export interface ExtractionResult {
  cleanedText: string;
  issue: string;
  polarity: string;
  confidence: number;
  latencyMs: number;
}

export interface DiagnosticMapping {
  tti: string;
  rbt: number;
  clt: "Intrinsic" | "Extraneous";
  isGap: boolean;
}

export interface StrategyResult {
  weightedCoefficient: number; // w_c
  priorityScore: number; // P
  totalFeedback: number;
  issueCount: number;
  isGap: boolean;
  triggersRecommendation: boolean; // P >= 0.30
}

// Module 2: Preprocessing (algorithm.pseudo L9)
export function preprocessFeedback(rawText: string): string {
  return CleanFeedback(rawText);
}

// Module 4: Pedagogical Diagnostic Mapping (algorithm.pseudo L12-15)
export function mapDiagnostics(issue: string, targetRbt: number): DiagnosticMapping {
  const tti = map_tti(issue);
  const rbt = map_rbt(issue);
  const clt = map_clt(issue);
  const isGap = issue !== "Uncategorized" && rbt <= targetRbt && clt === "Intrinsic";
  return { tti, rbt, clt, isGap };
}

// Module 5: Unified Priority Scoring (algorithm.pseudo L22-24)
export function computePriority(
  issueCount: number,
  totalFeedback: number,
  isGap: boolean,
): StrategyResult {
  const weightedCoefficient = isGap ? GAP_WEIGHT : NON_GAP_WEIGHT;
  const priorityScore = (issueCount / totalFeedback) * weightedCoefficient;
  return {
    weightedCoefficient,
    priorityScore,
    totalFeedback,
    issueCount,
    isGap,
    triggersRecommendation: priorityScore >= PRIORITY_THRESHOLD,
  };
}

// Module 5-6: Build the pedagogical cue (recommendation or warning) from the
// simulated diagnostic, matching GeneratePedagogicalCue's output shape.
export function buildCue(
  input: SimulationInput,
  issue: string,
  mapping: DiagnosticMapping,
  issueCount: number,
): RecommendationItem {
  const buffered: BufferedDiagnostic = {
    tti: mapping.tti,
    rbt: mapping.rbt,
    clt: mapping.clt,
    issue,
    polarity: "neu",
    isGap: mapping.isGap,
    count: issueCount,
  };
  const sessionContext: SessionContext = {
    course: "Simulation",
    topic: input.topic,
    targetIloRbt: input.targetRbt,
    iloStatement: input.iloStatement,
  };
  return GeneratePedagogicalCue(sessionContext, buffered, input.totalFeedback);
}

export function rbtLabel(level: number): string {
  return RBT_LEVELS[level] ?? String(level);
}
