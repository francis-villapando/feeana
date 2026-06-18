import type { AnalysisResult, Class, Feedback, Session } from "../types/types";

/** % of students who submitted at least one feedback per session.
 *  Counts only feedback that existed at analysis time (created_at <= last_analyzed_at)
 *  when the session has been analyzed. Falls back to all feedback otherwise. */
export function submissionRateForSession(
  session: Session,
  cls: Class | undefined,
  feedback: Feedback[],
): number {
  if (!cls || cls.studentCount === 0) return 0;
  const responses = feedback.filter((f) => {
    if (f.sessionId !== session.id) return false;
    if (session.last_analyzed_at) {
      return f.createdAt <= session.last_analyzed_at;
    }
    return true;
  }).length;
  return Math.min(100, Math.round((responses / cls.studentCount) * 100));
}

/** ILO achievement = % of active ILOs that have no flagged gaps in this session. */
export function iloAchievementForSession(
  session: Session,
  analyses: Record<string, AnalysisResult>,
): number {
  const analysis = analyses[session.id];
  if (!analysis) return 100; // Default to 100% (unflagged/achieved) if not yet analyzed

  const totalSessionIlos = session.iloIds.length;
  if (totalSessionIlos === 0) return 100;

  const flaggedIloIds = new Set<string>((analysis.gaps ?? []).map((g) => g.iloId));
  const achievedCount = totalSessionIlos - flaggedIloIds.size;

  return Math.round((achievedCount / totalSessionIlos) * 100);
}

export function averageRate(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Class-level participation: responses / (students × sessions). */
export function classParticipation(cls: Class, sessions: Session[], feedback: Feedback[]): number {
  if (!cls || cls.studentCount === 0 || sessions.length === 0) return 0;
  const responses = feedback.filter((f) => sessions.some((s) => s.id === f.sessionId)).length;
  return Math.min(100, Math.round((responses / (cls.studentCount * sessions.length)) * 100));
}

/** Map polarity label to numeric score: pos=+1, neu=0, neg=-1. */
function polarityScore(label: string): number {
  switch (label.toLowerCase()) {
    case "pos":
    case "positive":
      return 1;
    case "neg":
    case "negative":
      return -1;
    default:
      return 0;
  }
}

/** Average polarity across all aspects of all feedback in the session. */
export function avgPolarityForSession(session: Session, feedback: Feedback[]): number {
  const items = feedback.filter((f) => f.sessionId === session.id);
  const scores: number[] = [];
  for (const f of items) {
    for (const a of f.aspects) scores.push(polarityScore(a.polarity));
  }
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export interface RecommendationTrendPoint {
  topic: string;
  recommendations: number;
  avgPolarity: number;
}

/**
 * Trend over sessions that have a stored analysis result: number of
 * recommendations + average polarity. X is chronological by createdAt.
 */
export function recommendationTrendData(
  sessions: Session[],
  analyses: Record<string, AnalysisResult>,
  feedback: Feedback[],
): RecommendationTrendPoint[] {
  return [...sessions]
    .filter((s) => analyses[s.id])
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((s) => ({
      topic: s.topic,
      recommendations: analyses[s.id].recommendations.length,
      avgPolarity: Number(avgPolarityForSession(s, feedback).toFixed(2)),
    }));
}
