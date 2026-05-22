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

  const sessionScope = scope.filter((ilo) => session.iloIds.includes(ilo.id));
  const targetScope = sessionScope.length > 0 ? sessionScope : scope;
  const flaggedIloIds = new Set<string>((result?.gaps ?? []).map((g) => g.iloId));

  return targetScope.map((ilo) => {
    const achieved = !flaggedIloIds.has(ilo.id);
    return { ilo, achieved };
  });
}
