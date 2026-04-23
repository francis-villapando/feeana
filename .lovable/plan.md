
# Plan Update — ILO Gap Analysis row simplification

Single targeted change folded into the previously approved plan (Section 5).

## 5. Analysis page — ILO Gap Analysis redesign (revised)

Replace the current side-by-side gap rows with a **complete ILO checklist** for the session's course:

- **Source:** `MOCK_ILOS.filter(i => i.courseId === session.courseId && !i.archived)` (fall back to `session.iloIds` if no course match).
- **Status rule:**
  - **Achieved** — no feedback for the session flags this ILO as unmet.
  - **Not met** — at least one feedback item flags this ILO (mock rule: ILO appears in `result.gaps`, OR any pedagogical feedback's aspect carries `neg` polarity tagged to that ILO).
- **Row layout (simplified):** two elements only.
  1. Status icon — green `CheckCircle2` (`text-emerald-500`) for Achieved, red `AlertCircle` (`text-destructive`) for Not met.
  2. ILO statement text.
  - **No ILO code** (ILOs don't have codes in our data).
  - **No "why" snippet** under Not-met rows.
- **Helper:** `src/lib/iloStatus.ts` exports `computeIloStatuses(session, result, feedback): { ilo, achieved }[]` — pure function, returns only the boolean status (no `reason` field).

## All other plan sections remain unchanged

Sections 1, 2, 3, 4, 6, 7, 8, 9, 10 from the previously approved plan stay exactly as written. Only Section 5's row layout and the `iloStatus.ts` return shape change.
