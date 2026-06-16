/*
 * Type definitions for all algorithm modules (Modules 1–6).
 */

export type Polarity = "pos" | "neu" | "neg";

export type CltCategory = "Intrinsic" | "Extraneous";

export interface SessionContext {
  course: string;
  topic: string;
  targetIloRbt: number;
  sessionId?: string;
  iloStatement: string;
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
  distributionByClt?: never;
  distributionByRbt?: never;
  aspectCounts: Record<string, number>;
  polarityCounts: Record<string, number>;
}

export interface RecommendationItem {
  id: string;
  issue: string;
  paragraph: string;
  terms: Array<{
    text: string;
    kind: string;
    detail: string;
  }>;
  priority: number;
  theories: string[];
  isGap: boolean;
}

export interface WarningItem {
  id: string;
  issue: string;
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
