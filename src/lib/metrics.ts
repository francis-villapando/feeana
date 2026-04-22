import type { Class, Feedback, Session } from "./types";

/** % of students who submitted at least one feedback per session. Mock-friendly. */
export function submissionRateForSession(
  session: Session,
  cls: Class | undefined,
  feedback: Feedback[],
): number {
  if (!cls || cls.studentCount === 0) return 0;
  const responses = feedback.filter((f) => f.sessionId === session.id).length;
  return Math.min(100, Math.round((responses / cls.studentCount) * 100));
}

/** Mock ILO achievement = % of pedagogical feedback in session. */
export function iloAchievementForSession(
  session: Session,
  feedback: Feedback[],
): number {
  const items = feedback.filter((f) => f.sessionId === session.id);
  if (items.length === 0) return 0;
  const pedagogical = items.filter((f) => f.isPedagogical).length;
  return Math.round((pedagogical / items.length) * 100);
}

export function averageRate(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Class-level participation: responses / (students × sessions). */
export function classParticipation(
  cls: Class,
  sessions: Session[],
  feedback: Feedback[],
): number {
  if (!cls || cls.studentCount === 0 || sessions.length === 0) return 0;
  const responses = feedback.filter((f) =>
    sessions.some((s) => s.id === f.sessionId),
  ).length;
  return Math.min(
    100,
    Math.round((responses / (cls.studentCount * sessions.length)) * 100),
  );
}

/** Top label per session for an aspect-like dimension. */
export function topAspectPerSession(
  session: Session,
  feedback: Feedback[],
): { aspect: string; issue: string; polarity: string } {
  const items = feedback.filter((f) => f.sessionId === session.id);
  const aspectCounts = new Map<string, number>();
  const issueCounts = new Map<string, number>();
  const polarityCounts = new Map<string, number>();
  for (const f of items) {
    for (const a of f.aspects) {
      aspectCounts.set(a.aspect, (aspectCounts.get(a.aspect) ?? 0) + 1);
      issueCounts.set(a.issue, (issueCounts.get(a.issue) ?? 0) + 1);
      polarityCounts.set(a.polarity, (polarityCounts.get(a.polarity) ?? 0) + 1);
    }
  }
  const top = (m: Map<string, number>) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  return {
    aspect: top(aspectCounts),
    issue: top(issueCounts),
    polarity: top(polarityCounts),
  };
}

/** Numeric encodings for the trend line chart. */
export function aspectTrendData(
  sessions: Session[],
  feedback: Feedback[],
): Array<{
  topic: string;
  aspect: number;
  issue: number;
  polarity: number;
  aspectLabel: string;
  issueLabel: string;
  polarityLabel: string;
}> {
  const aspectIdx = new Map<string, number>();
  const issueIdx = new Map<string, number>();
  const polarityIdx = new Map<string, number>([
    ["pos", 3],
    ["neu", 2],
    ["neg", 1],
  ]);
  let aIdx = 1;
  let iIdx = 1;
  return [...sessions]
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .map((s) => {
      const top = topAspectPerSession(s, feedback);
      if (!aspectIdx.has(top.aspect)) aspectIdx.set(top.aspect, aIdx++);
      if (!issueIdx.has(top.issue)) issueIdx.set(top.issue, iIdx++);
      return {
        topic: s.topic,
        aspect: aspectIdx.get(top.aspect) ?? 0,
        issue: issueIdx.get(top.issue) ?? 0,
        polarity: polarityIdx.get(top.polarity) ?? 2,
        aspectLabel: top.aspect,
        issueLabel: top.issue,
        polarityLabel: top.polarity,
      };
    });
}
