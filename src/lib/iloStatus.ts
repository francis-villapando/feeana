import type { AnalysisResult, Feedback, ILO, Session } from "./types";
import { MOCK_ILOS } from "./mockData";

export interface IloStatus {
  ilo: ILO;
  achieved: boolean;
}

/**
 * Compute achieved/not-met status for every ILO of the session's course.
 * Pure function — easy to swap with a backend call later.
 */
export function computeIloStatuses(
  session: Session,
  result: AnalysisResult | null,
  feedback: Feedback[],
  ilos: ILO[] = MOCK_ILOS,
): IloStatus[] {
  // Source ILOs: prefer session.courseId match, fall back to session.iloIds.
  let scope = ilos.filter(
    (i) => i.courseId === session.courseId && !i.archived,
  );
  if (scope.length === 0) {
    scope = ilos.filter((i) => session.iloIds.includes(i.id));
  }

  const sessionFeedback = feedback.filter((f) => f.sessionId === session.id);
  const flaggedIloIds = new Set<string>(
    (result?.gaps ?? []).map((g) => g.iloId),
  );

  // Heuristic: any negative pedagogical feedback aspect implies the corresponding
  // session ILO(s) may not be met. Without explicit aspect↔ILO mapping in mock
  // data, treat the presence of `neg` polarity in pedagogical feedback as a
  // shared signal across all of the session's ILOs.
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
