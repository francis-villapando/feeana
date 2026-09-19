import { describe, expect, it } from "vitest";
import {
  avgPolarityForSession,
  computeDashboardIloAchievement,
  iloAchievementForSession,
} from "../../lib/hooks/metrics";
import type { AnalysisResult, Class, Session } from "../../lib/types/types";

function makeSession(id: string, classId: string, iloIds: string[]): Session {
  return {
    id,
    classId,
    courseId: "course-1",
    topic: `Topic ${id}`,
    topicId: "topic-1",
    iloIds,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    startsAt: "2026-01-01T00:00:00Z",
    endsAt: "2026-01-08T00:00:00Z",
    last_analyzed_at: "2026-01-08T00:00:00Z",
  };
}

function makeClass(id: string): Class {
  return {
    id,
    courseCode: "CS101",
    courseId: "course-1",
    courseDisplay: "CS101",
    section: "A",
    enrollCode: "ABC123",
    createdAt: "2026-01-01T00:00:00Z",
    archived: false,
    studentCount: 50,
  };
}

function makeResult(
  sessionId: string,
  totalFeedback: number,
  gaps: { iloId: string; feedbackId?: string }[],
): AnalysisResult {
  return {
    sessionId,
    totalFeedback,
    aspectDist: [],
    issueDist: [],
    polarityDist: [],
    rbtDist: [],
    cltDist: [],
    gaps: gaps.map((g) => ({
      iloId: g.iloId,
      expected: "expected",
      actual: "actual",
      severity: "high",
      feedbackId: g.feedbackId,
    })),
    recommendations: [],
    warnings: [],
  };
}

describe("iloAchievementForSession", () => {
  it("returns 100% when no feedback flags a gap", () => {
    const session = makeSession("s1", "c1", ["ilo-1"]);
    const analyses = { s1: makeResult("s1", 50, []) };
    expect(iloAchievementForSession(session, analyses)).toBe(100);
  });

  it("returns 98% when 1 of 50 feedbacks flags a gap", () => {
    const session = makeSession("s1", "c1", ["ilo-1"]);
    const analyses = {
      s1: makeResult("s1", 50, [{ iloId: "ilo-1", feedbackId: "fb-1" }]),
    };
    expect(iloAchievementForSession(session, analyses)).toBe(98);
  });

  it("returns 80% when 10 of 50 feedbacks flag a gap", () => {
    const session = makeSession("s1", "c1", ["ilo-1"]);
    const gaps = Array.from({ length: 10 }, (_, i) => ({
      iloId: "ilo-1",
      feedbackId: `fb-${i}`,
    }));
    const analyses = { s1: makeResult("s1", 50, gaps) };
    expect(iloAchievementForSession(session, analyses)).toBe(80);
  });

  it("returns 50% when 25 of 50 feedbacks flag a gap", () => {
    const session = makeSession("s1", "c1", ["ilo-1"]);
    const gaps = Array.from({ length: 25 }, (_, i) => ({
      iloId: "ilo-1",
      feedbackId: `fb-${i}`,
    }));
    const analyses = { s1: makeResult("s1", 50, gaps) };
    expect(iloAchievementForSession(session, analyses)).toBe(50);
  });

  it("returns 0% when all feedback flags a gap", () => {
    const session = makeSession("s1", "c1", ["ilo-1"]);
    const gaps = Array.from({ length: 50 }, (_, i) => ({
      iloId: "ilo-1",
      feedbackId: `fb-${i}`,
    }));
    const analyses = { s1: makeResult("s1", 50, gaps) };
    expect(iloAchievementForSession(session, analyses)).toBe(0);
  });

  it("counts multiple diagnostics from the same feedback as one gap", () => {
    const session = makeSession("s1", "c1", ["ilo-1"]);
    const analyses = {
      s1: makeResult("s1", 10, [
        { iloId: "ilo-1", feedbackId: "fb-1" },
        { iloId: "ilo-1", feedbackId: "fb-1" },
        { iloId: "ilo-1", feedbackId: "fb-1" },
      ]),
    };
    expect(iloAchievementForSession(session, analyses)).toBe(90);
  });

  it("averages per-ILO achievement across multiple ILOs", () => {
    const session = makeSession("s1", "c1", ["ilo-1", "ilo-2", "ilo-3"]);
    const analyses = {
      s1: makeResult("s1", 10, [
        { iloId: "ilo-2", feedbackId: "fb-1" },
        { iloId: "ilo-2", feedbackId: "fb-2" },
        { iloId: "ilo-3", feedbackId: "fb-1" },
        { iloId: "ilo-3", feedbackId: "fb-2" },
        { iloId: "ilo-3", feedbackId: "fb-3" },
        { iloId: "ilo-3", feedbackId: "fb-4" },
      ]),
    };
    expect(iloAchievementForSession(session, analyses)).toBe(80);
  });

  it("returns null when the session has no analysis", () => {
    const session = makeSession("s1", "c1", ["ilo-1"]);
    expect(iloAchievementForSession(session, {})).toBeNull();
  });

  it("returns null when the session has zero feedback", () => {
    const session = makeSession("s1", "c1", ["ilo-1"]);
    const analyses = { s1: makeResult("s1", 0, []) };
    expect(iloAchievementForSession(session, analyses)).toBeNull();
  });

  it("returns 100 when the session has no ILOs defined", () => {
    const session = makeSession("s1", "c1", []);
    const analyses = { s1: makeResult("s1", 10, []) };
    expect(iloAchievementForSession(session, analyses)).toBe(100);
  });
});

describe("computeDashboardIloAchievement", () => {
  it("preserves 0% class rates in the dashboard average", () => {
    const classA = makeClass("c1");
    const classB = makeClass("c2");
    const sessionA = makeSession("s1", "c1", ["ilo-1"]);
    const sessionB = makeSession("s2", "c2", ["ilo-1"]);
    const sessions = [sessionA, sessionB];
    const results = {
      s1: makeResult("s1", 10, []),
      s2: makeResult(
        "s2",
        10,
        Array.from({ length: 10 }, (_, i) => ({ iloId: "ilo-1", feedbackId: `fb-${i}` })),
      ),
    };
    expect(computeDashboardIloAchievement([classA, classB], sessions, results)).toBe(50);
  });
});

describe("avgPolarityForSession", () => {
  function result(polarityDist: [string, number][]): AnalysisResult {
    return {
      sessionId: "s1",
      totalFeedback: 0,
      aspectDist: [],
      issueDist: [],
      polarityDist: polarityDist.map(([label, value]) => ({ label, value })),
      rbtDist: [],
      cltDist: [],
      gaps: [],
      recommendations: [],
      warnings: [],
    };
  }

  it("returns +1.00 when all feedback is positive", () => {
    expect(
      avgPolarityForSession(
        result([
          ["Positive", 2],
          ["Neutral", 0],
          ["Negative", 0],
        ]),
      ),
    ).toBe(1);
  });

  it("returns -1.00 when all feedback is negative", () => {
    expect(
      avgPolarityForSession(
        result([
          ["Positive", 0],
          ["Neutral", 0],
          ["Negative", 3],
        ]),
      ),
    ).toBe(-1);
  });

  it("returns 0 when feedback is evenly positive and negative", () => {
    expect(
      avgPolarityForSession(
        result([
          ["Positive", 1],
          ["Neutral", 0],
          ["Negative", 1],
        ]),
      ),
    ).toBe(0);
  });

  it("returns 0 when all feedback is neutral", () => {
    expect(
      avgPolarityForSession(
        result([
          ["Positive", 0],
          ["Neutral", 4],
          ["Negative", 0],
        ]),
      ),
    ).toBe(0);
  });

  it("computes a mixed average rounded to two decimals", () => {
    expect(
      avgPolarityForSession(
        result([
          ["Positive", 2],
          ["Neutral", 0],
          ["Negative", 1],
        ]),
      ),
    ).toBe(0.33);
  });

  it("returns 0 when there is no analysis or no polarity distribution", () => {
    expect(avgPolarityForSession(undefined)).toBe(0);
    expect(avgPolarityForSession(result([]))).toBe(0);
  });

  it("matches labels case-insensitively", () => {
    expect(
      avgPolarityForSession(
        result([
          ["positive", 2],
          ["neutral", 0],
          ["negative", 0],
        ]),
      ),
    ).toBe(1);
  });
});
