import type { AnalysisResult, Class, DistEntry, Feedback, Session } from "../types/types";

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

/** ILO achievement = % of active ILOs that have no flagged gaps in this session.
 *  Caller must ensure `analyses[session.id]` exists — passes NaN otherwise. */
export function iloAchievementForSession(
  session: Session,
  analyses: Record<string, AnalysisResult>,
): number {
  const analysis = analyses[session.id];
  if (!analysis) return NaN;

  const totalSessionIlos = session.iloIds.length;
  if (totalSessionIlos === 0) return 100;

  const flaggedIloIds = new Set<string>((analysis.gaps ?? []).map((g) => g.iloId));
  const achievedCount = totalSessionIlos - flaggedIloIds.size;

  return Math.round((achievedCount / totalSessionIlos) * 100);
}

export function averageRate(values: number[]): number {
  const clean = values.filter((v) => !isNaN(v));
  if (clean.length === 0) return 0;
  return Math.round(clean.reduce((a, b) => a + b, 0) / clean.length);
}

/** Filter sessions that have analysis results cached. */
export function sessionsWithResults(
  sessions: Session[],
  results: Record<string, AnalysisResult>,
): Session[] {
  return sessions.filter((s) => results[s.id]);
}

/** Class-level submission rate: average of per-session submission rates.
 *  Only sessions with `last_analyzed_at` are included. */
export function computeClassSubmissionRate(
  classSessions: Session[],
  cls: Class | undefined,
  feedback: Feedback[],
): number {
  const analyzed = classSessions.filter((s) => s.last_analyzed_at);
  return averageRate(analyzed.map((s) => submissionRateForSession(s, cls, feedback)));
}

/** Class-level ILO achievement: average of per-session ILO rates.
 *  Only sessions with cached results are included. */
export function computeClassIloAchievement(
  classSessions: Session[],
  results: Record<string, AnalysisResult>,
): number {
  return averageRate(sessionsWithResults(classSessions, results).map((s) => iloAchievementForSession(s, results)));
}

/** Dashboard-level submission rate: per-class averages → dashboard average. */
export function computeDashboardSubmissionRate(
  activeClasses: Class[],
  sessions: Session[],
  feedback: Feedback[],
): number {
  const classRates = activeClasses
    .map((cls) => {
      const classSessions = sessions.filter((s) => s.classId === cls.id);
      return computeClassSubmissionRate(classSessions, cls, feedback);
    })
    .filter((r) => r > 0);
  return averageRate(classRates);
}

/** Dashboard-level ILO achievement: per-class ILO averages → dashboard average. */
export function computeDashboardIloAchievement(
  activeClasses: Class[],
  sessions: Session[],
  results: Record<string, AnalysisResult>,
): number {
  const classRates = activeClasses
    .map((cls) => {
      const classSessions = sessions.filter((s) => s.classId === cls.id);
      return computeClassIloAchievement(classSessions, results);
    })
    .filter((r) => r > 0);
  return averageRate(classRates);
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

export interface TrendPoint {
  topic: string;
  sessionId: string;
  submissionRate: number;
  iloAchievement: number;
  avgPolarity: number;
  recommendationCount: number;
  warningCount: number;
  aspectDist: DistEntry[];
  issueDist: DistEntry[];
  rbtDist: DistEntry[];
  cltDist: DistEntry[];
}

/**
 * Per-session trend data for a class: scalar metrics + distributions
 * across analyzed sessions, sorted chronologically by startsAt.
 */
export function classTrendData(
  sessions: Session[],
  analyses: Record<string, AnalysisResult>,
  cls: Class | undefined,
  feedback: Feedback[],
): TrendPoint[] {
  return [...sessions]
    .filter((s) => analyses[s.id])
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((s) => {
      const analysis = analyses[s.id];
      return {
        topic: s.topic,
        sessionId: s.id,
        submissionRate: submissionRateForSession(s, cls, feedback),
        iloAchievement: iloAchievementForSession(s, analyses),
        avgPolarity: Number(avgPolarityForSession(s, feedback).toFixed(2)),
        recommendationCount: analysis.recommendations.length,
        warningCount: analysis.warnings.length,
        aspectDist: analysis.aspectDist,
        issueDist: analysis.issueDist,
        rbtDist: analysis.rbtDist ?? [],
        cltDist: analysis.cltDist ?? [],
      };
    });
}
