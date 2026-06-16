import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { supabaseAdmin } from "./supabase-admin";
import type { PipelineOutput } from "../lib/algorithm/types";

/* Constants */
const TEST_SESSION_ID = "f1234567-1234-4321-abcd-000000000001";
const FACULTY_EMAIL = "faculty@test.com";
const FACULTY_PASSWORD = "faculty123";

/* Mock — intercepts getMLWorker() so runAnalysis() uses fake output */
const mockRun = vi.fn();
const mockPreload = vi.fn().mockResolvedValue(undefined);

vi.mock("../../mlWorkerStore", () => ({
  getMLWorker: vi.fn(() => ({
    api: {
      preloadModel: mockPreload,
      run: mockRun,
    },
  })),
}));

// above mock must be hoisted above the subject import
import { runAnalysis, fetchAnalysisResult } from "../lib/orchestration/analysis";
import { supabase } from "../lib/db/supabase";

/* Suite-level state */
let testFeedbackIds: string[] = [];

/* Helpers */
function buildMockOutput(feedbackIds: string[]): PipelineOutput {
  const diagnostics = [
    {
      feedbackId: feedbackIds[0],
      tti: "Interactive Lecture",
      rbt: 3,
      clt: "Intrinsic" as const,
      issue: "clarity deficit",
      polarity: "neg" as const,
      isGap: true,
    },
    {
      feedbackId: feedbackIds[1],
      tti: "Pacing",
      rbt: 2,
      clt: "Intrinsic" as const,
      issue: "clarity deficit",
      polarity: "neg" as const,
      isGap: true,
    },
    {
      feedbackId: feedbackIds[2],
      tti: "Seatwork",
      rbt: 4,
      clt: "Extraneous" as const,
      issue: "instructional cadence",
      polarity: "neu" as const,
      isGap: false,
    },
  ];

  return {
    recommendationList: [
      {
        id: "rec-1",
        issue: "clarity deficit",
        paragraph:
          "Students report difficulty following the lesson. Consider using more structured examples and checking for understanding frequently.",
        terms: [],
        priority: 0.67,
        theories: ["Cognitive Load Theory"],
        isGap: true,
      },
    ],
    warningList: [],
    stats: {
      totalFeedback: feedbackIds.length,
      issueCounts: { "clarity deficit": 2, "instructional cadence": 1 },
      gapCount: 2,
      aspectCounts: { "clarity deficit": 2, "instructional cadence": 1 },
      polarityCounts: { pos: 0, neu: 1, neg: 2 },
    },
    diagnostics,
  };
}

async function cleanCreatedData(): Promise<void> {
  await supabaseAdmin.from("feedback_diagnostics").delete().eq("session_id", TEST_SESSION_ID);
  await supabaseAdmin.from("analysis_results").delete().eq("session_id", TEST_SESSION_ID);
  await supabaseAdmin.from("feedback").delete().eq("session_id", TEST_SESSION_ID);
  await supabaseAdmin.from("sessions").delete().eq("id", TEST_SESSION_ID);
}

/* Suite */
describe("Pipeline Integration Tests", () => {
  beforeAll(async () => {
    /* clean any leftover from a prior aborted run */
    await cleanCreatedData();

    /* resolve seed references */
    const { data: classRow } = await supabaseAdmin
      .from("classes")
      .select("id, course_id")
      .eq("section", "3CS-C")
      .eq("course", "CSEG2")
      .single();

    if (!classRow) {
      throw new Error("Seed class 3CS-C / CSEG2 not found. Ensure seed.sql has been run.");
    }

    const { data: ilos } = await supabaseAdmin
      .from("ilos")
      .select("id")
      .eq("course_id", classRow.course_id)
      .eq("archived", false);

    const iloIds = (ilos ?? []).map(i => i.id);

    const { data: courseRow } = await supabaseAdmin
      .from("courses")
      .select("title")
      .eq("id", classRow.course_id)
      .single();

    /* create an isolated test session */
    const { error: sessionErr } = await supabaseAdmin.from("sessions").insert({
      id: TEST_SESSION_ID,
      class_id: classRow.id,
      course_id: classRow.course_id,
      topic: "Pipeline Integration Test Session",
      status: "active",
      ilo_ids: iloIds,
      last_analyzed_at: null,
    });

    if (sessionErr) {
      throw new Error(`Failed to create test session: ${sessionErr.message}`);
    }

    /* create 3 feedback entries */
    const feedbackEntries = [
      { session_id: TEST_SESSION_ID, content: "The lesson was too fast and I couldn't follow." },
      { session_id: TEST_SESSION_ID, content: "More examples please, the topic is confusing." },
      { session_id: TEST_SESSION_ID, content: "The seatwork was manageable but the lecture part was hard." },
    ];

    const { data: insertedFeedback, error: fbErr } = await supabaseAdmin
      .from("feedback")
      .insert(feedbackEntries)
      .select("id");

    if (fbErr || !insertedFeedback) {
      throw new Error(`Failed to insert test feedback: ${fbErr?.message}`);
    }

    testFeedbackIds = insertedFeedback.map(f => f.id);

    /* config the mock to return diagnostics referencing our feedback IDs */
    mockRun.mockResolvedValue(buildMockOutput(testFeedbackIds));

    /* sign in as faculty so runAnalysis() passes RLS */
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: FACULTY_EMAIL,
      password: FACULTY_PASSWORD,
    });
    if (signInErr) {
      throw new Error(`Sign-in failed for ${FACULTY_EMAIL}: ${signInErr.message}`);
    }
  });

  afterAll(async () => {
    await supabase.auth.signOut();
    await cleanCreatedData();
  });

  /* Tests */
  it("1. runAnalysis() fetches session data correctly and returns a result", async () => {
    const result = await runAnalysis(TEST_SESSION_ID);

    expect(result).not.toBeNull();
    expect(result.sessionId).toBe(TEST_SESSION_ID);
    expect(result.totalFeedback).toBe(testFeedbackIds.length);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(mockPreload).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it("2. pipeline saves results to analysis_results and feedback_diagnostics", async () => {
    /* analysis_results */
    const { data: ar } = await supabaseAdmin
      .from("analysis_results")
      .select("*")
      .eq("session_id", TEST_SESSION_ID);

    expect(ar).not.toBeNull();
    expect(ar!.length).toBe(1);
    expect(ar![0].is_mock).toBe(false);

    /* feedback_diagnostics */
    const { data: diag } = await supabaseAdmin
      .from("feedback_diagnostics")
      .select("*")
      .eq("session_id", TEST_SESSION_ID);

    expect(diag).not.toBeNull();
    expect(diag!.length).toBe(testFeedbackIds.length);

    /* last_analyzed_at */
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("last_analyzed_at")
      .eq("id", TEST_SESSION_ID)
      .single();

    expect(session!.last_analyzed_at).not.toBeNull();
    expect(new Date(session!.last_analyzed_at).getTime()).not.toBeNaN();
  });

  it("3. fetchAnalysisResult() retrieves saved results", async () => {
    const result = await fetchAnalysisResult(TEST_SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe(TEST_SESSION_ID);
    expect(result!.totalFeedback).toBe(testFeedbackIds.length);
    expect(result!.recommendations.length).toBeGreaterThan(0);
    expect(result!.aspectDist.length).toBeGreaterThan(0);
    expect(result!.polarityDist.length).toBe(3);
    expect(result!.issueDist.length).toBeGreaterThan(0);
  });

  it("4. diagnostic records in the DB match expected schema", async () => {
    const { data: diag } = await supabaseAdmin
      .from("feedback_diagnostics")
      .select("*")
      .eq("session_id", TEST_SESSION_ID);

    expect(diag).not.toBeNull();
    expect(diag!.length).toBeGreaterThan(0);

    const validPolarities = new Set(["pos", "neu", "neg"]);
    const validClts = new Set(["Intrinsic", "Extraneous"]);

    for (const record of diag!) {
      expect(record.feedback_id).toBeTruthy();
      expect(record.session_id).toBe(TEST_SESSION_ID);
      expect(record.tti).toBeTruthy();
      expect(Number.isInteger(record.rbt)).toBe(true);
      expect(record.rbt).toBeGreaterThanOrEqual(1);
      expect(record.rbt).toBeLessThanOrEqual(6);
      expect(validClts.has(record.clt)).toBe(true);
      expect(record.issue).toBeTruthy();
      expect(validPolarities.has(record.polarity)).toBe(true);
      expect(typeof record.is_gap).toBe("boolean");
    }
  });

  it("5. re-analysis overwrites previous results cleanly", async () => {
    /* run twice */
    await runAnalysis(TEST_SESSION_ID);
    await runAnalysis(TEST_SESSION_ID);

    /* still exactly 1 analysis_results row */
    const { data: ar } = await supabaseAdmin
      .from("analysis_results")
      .select("id", { count: "exact" })
      .eq("session_id", TEST_SESSION_ID);

    expect(ar).not.toBeNull();
    expect(ar!.length).toBe(1);

    /* still exactly N feedback_diagnostics rows */
    const { data: diag } = await supabaseAdmin
      .from("feedback_diagnostics")
      .select("id", { count: "exact" })
      .eq("session_id", TEST_SESSION_ID);

    expect(diag).not.toBeNull();
    expect(diag!.length).toBe(testFeedbackIds.length);
  });
});
