/*
 * Module 1 / Module 2 shared type definitions.
 * This file defines the exact input/output contracts used by the algorithm pipeline.
 * It maps directly to the pseudocode variables in algorithm.pseudo and supports
 * downstream modules with strongly typed data transfer objects.
 */

export type Polarity = "pos" | "neu" | "neg";

export type CltCategory = "Intrinsic" | "Extraneous";

export interface SessionContext {
  course: string;
  topic: string;
  targetIloRbt: number;
  sessionId?: string;
}

export interface FeedbackInput {
  id: string;
  rawText: string;
  createdAt?: string;
}

export interface PreprocessResult {
  cleanedText: string;
}

export interface IssueExtractionResult {
  issue: string;
  polarity: Polarity;
}

export interface DiagnosticRecord {
  tti: string;
  rbt: number;
  clt: CltCategory;
  issue: string;
  polarity: Polarity;
  isGap: boolean;
  feedbackId?: string;
}

export interface BufferedDiagnostic extends DiagnosticRecord {
  count: number;
}

export interface StrategyStats {
  totalFeedback: number;
  issueCounts: Record<string, number>;
  gapCount: number;
  distributionByClt: Record<CltCategory, number>;
  distributionByRbt: Record<number, number>;
}

export interface RecommendationItem {
  id: string;
  issue: string;
  paragraph: string;
  priority: number;
  theories: string[];
  isGap: boolean;
}

export interface WarningItem {
  id: string;
  issue: string;
  warning: string;
  count: number;
}

export interface PipelineOutput {
  recommendationList: RecommendationItem[];
  warningList: WarningItem[];
  stats: StrategyStats;
  diagnostics?: DiagnosticRecord[];
}

export interface AlgorithmPipeline {
  run(
    sessionContext: SessionContext,
    feedbackStream: FeedbackInput[],
  ): Promise<PipelineOutput>;
}
