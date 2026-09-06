// Module 1: Data Collection
// Assembles faculty metadata and raw student feedback into typed inputs.

import type { SessionContext, FeedbackInput } from "./types";

interface RawFeedbackRow {
  id: string;
  content: string;
  created_at?: string;
}

export function collectPipelineData(
  course: string,
  topic: string,
  targetIloRbt: number,
  sessionId: string,
  iloStatement: string,
  rawFeedbackRows: RawFeedbackRow[],
  ilos?: { index: number; statement: string; level: number }[],
): { sessionContext: SessionContext; feedbackStream: FeedbackInput[] } {
  return {
    sessionContext: { course, topic, targetIloRbt, sessionId, iloStatement, ilos },
    feedbackStream: rawFeedbackRows.map((f) => ({
      id: f.id,
      rawText: f.content,
      createdAt: f.created_at,
    })),
  };
}
