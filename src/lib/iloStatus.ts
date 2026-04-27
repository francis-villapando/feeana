import { useCourseStore } from "./courseStore";
import type { AnalysisResult, Feedback, ILO, Session } from "./types";

export interface IloStatus {
  ilo: ILO;
  achieved: boolean;
}

export function computeIloStatuses(
  session: Session,
  result: AnalysisResult | null,
  feedback: Feedback[],
  ilos: ILO[],
): IloStatus[] {
  let scope = ilos.filter((i) => i.courseId === session.courseId && !i.archived);
  if (scope.length === 0) {
    scope = ilos.filter((i) => session.iloIds.includes(i.id));
  }

  const sessionFeedback = feedback.filter((f) => f.sessionId === session.id);
  const flaggedIloIds = new Set<string>((result?.gaps ?? []).map((g) => g.iloId));

  const hasAnyNegative = sessionFeedback.some(
    (f) => f.isPedagogical && f.aspects.some((a) => a.polarity === "neg"),
  );

  return scope.map((ilo) => {
    const flagged = flaggedIloIds.has(ilo.id);
    const sessionOwnsIlo = session.iloIds.includes(ilo.id);
    const achieved = !(flagged || (hasAnyNegative && sessionOwnsIlo));
    return { ilo, achieved };
  });
}
