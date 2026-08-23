import type { Feedback, Session } from "@/lib/types/types";

export interface FeedbackStatus {
  total: number;
  newCount: number;
  isAnalyzed: boolean;
  hasNew: boolean;
}

export function computeFeedbackStatus(
  session: Pick<Session, "id" | "last_analyzed_at">,
  feedbackList: Feedback[],
): FeedbackStatus {
  const sessionFeedback = feedbackList.filter((f) => f.sessionId === session.id);
  const total = sessionFeedback.length;
  const { last_analyzed_at } = session;

  if (!last_analyzed_at) {
    return { total, newCount: total, isAnalyzed: false, hasNew: total > 0 };
  }

  const lastDate = new Date(last_analyzed_at);
  const newCount = sessionFeedback.filter((f) => new Date(f.createdAt) > lastDate).length;

  return { total, newCount, isAnalyzed: true, hasNew: newCount > 0 };
}
