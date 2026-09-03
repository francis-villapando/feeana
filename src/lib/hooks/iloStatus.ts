import type { AnalysisResult, Feedback, ILO, Session } from "../types/types";

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

  const flaggedIloIds = new Set<string>((result?.gaps ?? []).map((g) => g.iloId));

  return scope.map((ilo) => {
    const achieved = !flaggedIloIds.has(ilo.id);
    return { ilo, achieved };
  });
}
