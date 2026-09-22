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

export function iloAchievementForSession(
  session: Session,
  analyses: Record<string, AnalysisResult>,
): number | null {
  const analysis = analyses[session.id];
  if (!analysis || analysis.totalFeedback === 0) return null;

  const totalSessionIlos = session.iloIds.length;
  if (totalSessionIlos === 0) return 100;

  const gaps = analysis.gaps ?? [];
  const totalFeedback = analysis.totalFeedback;

  const perIloAchievement = session.iloIds.map((iloId) => {
    const uniqueGaps = new Set<string>();
    for (const gap of gaps) {
      if (gap.iloId !== iloId) continue;
      uniqueGaps.add(gap.feedbackId ?? `legacy:${iloId}`);
    }
    const gapRate = uniqueGaps.size / totalFeedback;
    return Math.max(0, Math.min(100, Math.round(100 - gapRate * 100)));
  });

  return Math.round(perIloAchievement.reduce((a, b) => a + b, 0) / perIloAchievement.length);
}

export function averageRate(values: number[]): number | null {
  const clean = values.filter((v) => typeof v === "number" && !isNaN(v));
  if (clean.length === 0) return null;
  return Math.round(clean.reduce((a, b) => a + b, 0) / clean.length);
}

export function sessionsWithResults(
  sessions: Session[],
  results: Record<string, AnalysisResult>,
): Session[] {
  return sessions.filter((s) => results[s.id]);
}

/** Only sessions with `last_analyzed_at` are included. */
export function computeClassSubmissionRate(
  classSessions: Session[],
  cls: Class | undefined,
  feedback: Feedback[],
): number | null {
  const analyzed = classSessions.filter((s) => s.last_analyzed_at);
  if (analyzed.length === 0) return null;
  return averageRate(analyzed.map((s) => submissionRateForSession(s, cls, feedback)));
}

/** Only sessions with cached results are included. */
export function computeClassIloAchievement(
  classSessions: Session[],
  results: Record<string, AnalysisResult>,
): number | null {
  const analyzed = sessionsWithResults(classSessions, results);
  if (analyzed.length === 0) return null;
  const rates = analyzed
    .map((s) => iloAchievementForSession(s, results))
    .filter((r): r is number => r !== null);
  return averageRate(rates);
}

export function computeDashboardSubmissionRate(
  activeClasses: Class[],
  sessions: Session[],
  feedback: Feedback[],
): number | null {
  const classRates = activeClasses
    .map((cls) => {
      const classSessions = sessions.filter((s) => s.classId === cls.id);
      return computeClassSubmissionRate(classSessions, cls, feedback);
    })
    .filter((r): r is number => r !== null);
  return averageRate(classRates);
}

export function computeDashboardIloAchievement(
  activeClasses: Class[],
  sessions: Session[],
  results: Record<string, AnalysisResult>,
): number | null {
  const classRates = activeClasses
    .map((cls) => {
      const classSessions = sessions.filter((s) => s.classId === cls.id);
      return computeClassIloAchievement(classSessions, results);
    })
    .filter((r): r is number => r !== null);
  return averageRate(classRates);
}

export function classParticipation(cls: Class, sessions: Session[], feedback: Feedback[]): number {
  if (!cls || cls.studentCount === 0 || sessions.length === 0) return 0;
  const responses = feedback.filter((f) => sessions.some((s) => s.id === f.sessionId)).length;
  return Math.min(100, Math.round((responses / (cls.studentCount * sessions.length)) * 100));
}

/** Average polarity from the session's cached polarity distribution: pos=+1, neu=0, neg=-1. */
export function avgPolarityForSession(analysis?: AnalysisResult): number {
  if (!analysis?.polarityDist || analysis.polarityDist.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const entry of analysis.polarityDist) {
    counts[entry.label.toLowerCase()] = entry.value;
  }
  const pos = counts["positive"] ?? 0;
  const neg = counts["negative"] ?? 0;
  const neu = counts["neutral"] ?? 0;
  const total = pos + neg + neu;
  if (total === 0) return 0;
  return Number(((pos - neg) / total).toFixed(2));
}

export interface TrendPoint {
  topic: string;
  sessionId: string;
  submissionRate: number;
  iloAchievement: number | null;
  avgPolarity: number;
  recommendationCount: number;
  primaryRecommendationCount: number;
  secondaryRecommendationCount: number;
  warningCount: number;
  aspectDist: DistEntry[];
  issueDist: DistEntry[];
  rbtDist: DistEntry[];
  cltDist: DistEntry[];
}

/** Per-session trend rows for analyzed sessions, sorted by `startsAt`. */
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
        avgPolarity: avgPolarityForSession(analysis),
        recommendationCount: analysis.recommendations.length,
        primaryRecommendationCount: analysis.recommendations.filter((r) => r.tier === "primary")
          .length,
        secondaryRecommendationCount: analysis.recommendations.filter((r) => r.tier === "secondary")
          .length,
        warningCount: analysis.warnings.length,
        aspectDist: analysis.aspectDist,
        issueDist: analysis.issueDist,
        rbtDist: analysis.rbtDist ?? [],
        cltDist: analysis.cltDist ?? [],
      };
    });
}
