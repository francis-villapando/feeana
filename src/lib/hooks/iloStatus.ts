import type { AnalysisResult, Feedback, ILO, Session } from "../types/types";

export interface IloStatus {
  ilo: ILO;
  achieved: boolean;
  achievementRate: number;
  gapCount: number;
}

function uniqueGapFeedbackCount(gaps: AnalysisResult["gaps"], iloId: string): number {
  const ids = new Set<string>();
  for (const gap of gaps) {
    if (gap.iloId !== iloId) continue;
    ids.add(gap.feedbackId ?? `legacy:${iloId}`);
  }
  return ids.size;
}

export function computeIloStatuses(
  session: Session,
  result: AnalysisResult | null,
  feedback: Feedback[],
  ilos: ILO[],
): IloStatus[] {
  // A session's ILOs come from its topic (course -> topics -> ILOs). Prefer the
  // explicitly stored iloIds; fall back to the topic's ILOs; never expand to all
  // course ILOs, which would misrepresent the session's scope.
  let scope: ILO[];
  if (session.iloIds.length > 0) {
    scope = ilos.filter((i) => session.iloIds.includes(i.id) && !i.archived);
  } else if (session.topicId) {
    scope = ilos.filter((i) => i.topicId === session.topicId && !i.archived);
  } else {
    scope = [];
  }

  const gaps = result?.gaps ?? [];
  const totalFeedback = result?.totalFeedback ?? 0;

  return scope.map((ilo) => {
    const gapCount = uniqueGapFeedbackCount(gaps, ilo.id);
    const achievementRate =
      totalFeedback === 0
        ? 100
        : Math.max(0, Math.min(100, Math.round(100 - (gapCount / totalFeedback) * 100)));
    return { ilo, achieved: achievementRate === 100, achievementRate, gapCount };
  });
}
