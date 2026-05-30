/*
 * Module 1: Data Collection and end-to-end orchestration.
 * This file implements the exact loop and logic in algorithm.pseudo.
 * It delegates preprocessing, extraction, mapping, strategy, and output formatting
 * to specialized modules while providing console boundary logging for visibility.
 */

import type {
  SessionContext,
  FeedbackInput,
  DiagnosticRecord,
  BufferedDiagnostic,
  PipelineOutput,
} from "./types";
import { Preprocess } from "./preprocess";
import { ExtractPID } from "./informationExtraction";
import { map_tti, map_rbt, map_clt } from "./pedagogicalDiagnosticMapping";
import {
  CalculateDistributions,
  GeneratePedagogicalCue,
  GenerateDiagnosticWarning,
} from "./strategyGeneration";
import { formatDashboardOutput } from "./dashboardOutput";

const PRIORITY_THRESHOLD = 0.3;

export async function runAlgorithmPipeline(
  sessionContext: SessionContext,
  feedbackStream: FeedbackInput[],
): Promise<PipelineOutput> {
  console.debug("[pipeline] Starting algorithm pipeline", {
    sessionContext,
    feedbackCount: feedbackStream.length,
  });

  // Module 1: Data Collection
  const recommendationList: ReturnType<typeof GeneratePedagogicalCue>[] = [];
  const warningList: ReturnType<typeof GenerateDiagnosticWarning>[] = [];
  const buffer: DiagnosticRecord[] = [];

  // Module 2, 3, & 4: Preprocess + ExtractPID + Pedagogical Diagnostic Mapping
  for (let i = 0; i < feedbackStream.length; i++) {
    const feedback = feedbackStream[i];
    
    if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage({
        type: 'INFERENCE_PROGRESS',
        payload: {
          current: i + 1,
          total: feedbackStream.length,
          text: feedback.rawText.slice(0, 60)
        }
      });
    }

    console.debug("[pipeline] Processing feedback", { feedbackId: feedback.id });

    const cleanText = Preprocess(feedback);
    console.debug("[pipeline] Preprocess output", { cleanText });

    const extraction = await ExtractPID(cleanText);
    console.debug("[pipeline] Extraction output", { extraction });

    const tti = map_tti(extraction.issue);
    const rbt = map_rbt(extraction.issue);
    const clt = map_clt(extraction.issue);
    const isGap = rbt <= sessionContext.targetIloRbt && clt === "Intrinsic";

    buffer.push({
      tti,
      rbt,
      clt,
      issue: extraction.issue,
      polarity: extraction.polarity,
      isGap,
      feedbackId: feedback.id,
    });
  }

  // Module 5: Strategy Generation
  const totalFeedback = feedbackStream.length;
  const stats = CalculateDistributions(buffer, totalFeedback);
  console.debug("[pipeline] Strategy stats computed", { stats });

  const uniqueIssueMap = new Map<string, BufferedDiagnostic>();

  for (const diagnostic of buffer) {
    const key = diagnostic.issue.toLowerCase();
    const existing = uniqueIssueMap.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      uniqueIssueMap.set(key, { ...diagnostic, count: 1 });
    }
  }

  for (const uniqueIssue of uniqueIssueMap.values()) {
    if (uniqueIssue.issue === "Uncategorized") {
      continue; // Skip generating recommendations/warnings for uncategorized feedback
    }

    const w_c = uniqueIssue.isGap ? 1.5 : 1.0;
    const P = (uniqueIssue.count / totalFeedback) * w_c;

    console.debug("[pipeline] Issue scoring", {
      issue: uniqueIssue.issue,
      count: uniqueIssue.count,
      isGap: uniqueIssue.isGap,
      weight: w_c,
      priorityScore: P,
    });

    if (P >= PRIORITY_THRESHOLD) {
      const recommendation = GeneratePedagogicalCue(
        sessionContext,
        uniqueIssue,
        totalFeedback
      );
      recommendationList.push(recommendation);
    } else {
      const warning = GenerateDiagnosticWarning(uniqueIssue);
      warningList.push(warning);
    }
  }

  // Module 6: Dashboard Output
  const output = formatDashboardOutput(recommendationList, warningList, stats);
  console.debug("[pipeline] Completed algorithm pipeline", { output });

  return {
    ...output,
    diagnostics: buffer,
  };
}
