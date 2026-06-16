/*
 * Assembles all pipeline inputs: faculty metadata and student feedback.
 * The caller is responsible for fetching data from Supabase; this module only constructs typed objects.
 */

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
): { sessionContext: SessionContext; feedbackStream: FeedbackInput[] } {
  return {
    sessionContext: { course, topic, targetIloRbt, sessionId, iloStatement },
    feedbackStream: rawFeedbackRows.map(f => ({
      id: f.id,
      rawText: f.content,
      createdAt: f.created_at,
    })),
  };
}
