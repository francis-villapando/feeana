import { describe, it, expect } from "vitest";
import { computeIloStatuses } from "../../lib/hooks/iloStatus";
import type { AnalysisResult, ILO, Session } from "../../lib/types/types";

const courseId = "course-1";
const topicA = "topic-a";
const topicB = "topic-b";

const ilos: ILO[] = [
  { id: "ilo-a1", courseId, topicId: topicA, statement: "A1", bloomLevel: "Remember", archived: false, version: 1 },
  { id: "ilo-a2", courseId, topicId: topicA, statement: "A2", bloomLevel: "Understand", archived: false, version: 1 },
  { id: "ilo-b1", courseId, topicId: topicB, statement: "B1", bloomLevel: "Apply", archived: false, version: 1 },
  { id: "ilo-a3", courseId, topicId: topicA, statement: "A3", bloomLevel: "Remember", archived: true, version: 1 },
];

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    classId: "class-1",
    courseId,
    topic: "Topic A",
    topicId: topicA,
    iloIds: [],
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    startsAt: "2026-01-01T00:00:00Z",
    endsAt: "2026-01-08T00:00:00Z",
    last_analyzed_at: null,
    ...overrides,
  };
}

function makeResult(flaggedIloIds: string[]): AnalysisResult {
  return {
    sessionId: "s1",
    totalFeedback: 1,
    aspectDist: [],
    issueDist: [],
    polarityDist: [],
    rbtDist: [],
    cltDist: [],
    gaps: flaggedIloIds.map((iloId) => ({
      iloId,
      expected: "expected",
      actual: "actual",
      severity: "high",
    })),
    recommendations: [],
    warnings: [],
  };
}

describe("computeIloStatuses", () => {
  it("uses the session's stored iloIds when present", () => {
    const session = makeSession({ iloIds: ["ilo-a1", "ilo-a2"] });
    const statuses = computeIloStatuses(session, null, [], ilos);
    expect(statuses.map((s) => s.ilo.id)).toEqual(["ilo-a1", "ilo-a2"]);
  });

  it("falls back to the topic's ILOs when iloIds is empty", () => {
    const session = makeSession({ iloIds: [] });
    const statuses = computeIloStatuses(session, null, [], ilos);
    expect(statuses.map((s) => s.ilo.id)).toEqual(["ilo-a1", "ilo-a2"]);
  });

  it("excludes archived ILOs from the topic fallback", () => {
    const session = makeSession({ iloIds: [] });
    const statuses = computeIloStatuses(session, null, [], ilos);
    expect(statuses.some((s) => s.ilo.id === "ilo-a3")).toBe(false);
  });

  it("returns empty when the session has no topic and no iloIds", () => {
    const session = makeSession({ topicId: undefined, iloIds: [] });
    const statuses = computeIloStatuses(session, null, [], ilos);
    expect(statuses).toEqual([]);
  });

  it("marks ILOs with flagged gaps as not achieved", () => {
    const session = makeSession({ iloIds: ["ilo-a1", "ilo-a2"] });
    const result = makeResult(["ilo-a1"]);
    const statuses = computeIloStatuses(session, result, [], ilos);
    expect(statuses.find((s) => s.ilo.id === "ilo-a1")?.achieved).toBe(false);
    expect(statuses.find((s) => s.ilo.id === "ilo-a2")?.achieved).toBe(true);
  });
});
