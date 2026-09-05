import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { supabaseAdmin } from "../helpers/supabaseAdmin";
import { adminExec, closeAdminSqlClient } from "../../lib/db/adminSql";
import type { DiagnosticRecord } from "../../lib/algorithm/types";

/* Constants */
const TEST_SESSION_ID = "f1234567-1234-4321-abcd-000000000001";
const FACULTY_EMAIL = "faculty@test.com";
const FACULTY_PASSWORD = "faculty123";

/* Mock — intercepts getMLWorkerAsync() so runAnalysisPipeline() uses fake output */
const mockRunInference = vi.fn();
const mockPreload = vi.fn().mockResolvedValue(undefined);

vi.mock("../../lib/ml/mlWorkerStore", () => ({
  getMLWorkerAsync: vi.fn(async () => ({
    api: {
      preloadModel: mockPreload,
      runInference: mockRunInference,
    },
  })),
}));

// above mock must be hoisted above the subject import
import { runAnalysisPipeline, fetchComputedResult } from "../../lib/algorithm/pipeline";
import { supabase } from "../../lib/db/supabase";

/* Suite-level state */
let testFeedbackIds: string[] = [];

/* Helpers */
function buildMockOutput(feedbackIds: string[]): DiagnosticRecord[] {
  return [
    {
      feedbackId: feedbackIds[0],
      issue: "clarity deficit",
      polarity: "neg",
      tti: "Instructional Learning Formats",
      rbt: 5,
      clt: "Extraneous",
      isGap: false,
    },
    {
      feedbackId: feedbackIds[1],
      issue: "clarity deficit",
      polarity: "neg",
      tti: "Instructional Learning Formats",
      rbt: 5,
      clt: "Extraneous",
      isGap: false,
    },
    {
      feedbackId: feedbackIds[2],
      issue: "instructional cadence",
      polarity: "neu",
      tti: "Productivity",
      rbt: 2,
      clt: "Extraneous",
      isGap: false,
    },
  ];
}

let fixtureCourseId: string | null = null;
let fixtureClassId: string | null = null;

async function cleanCreatedData(): Promise<void> {
  await adminExec([
    { text: "DELETE FROM feedback_diagnostics WHERE session_id = $1", params: [TEST_SESSION_ID] },
    { text: "DELETE FROM analysis_results WHERE session_id = $1", params: [TEST_SESSION_ID] },
    { text: "DELETE FROM feedback WHERE session_id = $1", params: [TEST_SESSION_ID] },
    { text: "DELETE FROM sessions WHERE id = $1", params: [TEST_SESSION_ID] },
  ]);
  if (fixtureClassId) {
    await supabaseAdmin.from("classes").delete().eq("id", fixtureClassId);
    fixtureClassId = null;
  }
  if (fixtureCourseId) {
    await supabaseAdmin.from("courses").delete().eq("id", fixtureCourseId);
    fixtureCourseId = null;
  }
}

/* Suite */
describe("Pipeline Integration Tests", () => {
  beforeAll(async () => {
    /* clean any leftover from a prior aborted run */
    await cleanCreatedData();

    /* resolve faculty profile */
    const { data: facultyProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", FACULTY_EMAIL)
      .maybeSingle();

    if (!facultyProfile) {
      throw new Error(
        `Faculty profile for ${FACULTY_EMAIL} not found. Ensure seed data has been run.`,
      );
    }

    /* resolve or create class owned by faculty */
    let classId: string;
    let courseId: string;
    let iloIds: string[] = [];

    const { data: existingClass } = await supabaseAdmin
      .from("classes")
      .select("id, course_id")
      .eq("faculty_id", facultyProfile.id)
      .limit(1)
      .maybeSingle();

    if (existingClass) {
      classId = existingClass.id;
      courseId = existingClass.course_id;
      const { data: ilos } = await supabaseAdmin
        .from("ilos")
        .select("id")
        .eq("course_id", courseId)
        .eq("archived", false);
      iloIds = (ilos ?? []).map((i) => i.id);
    } else {
      const TS = Date.now();
      const { data: newCourse, error: courseErr } = await supabaseAdmin
        .from("courses")
        .insert({ code: `PIPE-${TS}`, title: "Pipeline Integration Test Course" })
        .select("id")
        .single();
      if (courseErr || !newCourse) {
        throw new Error(`Failed to create fixture course: ${courseErr?.message}`);
      }
      fixtureCourseId = newCourse.id;
      courseId = newCourse.id;

      const { data: newClass, error: clsErr } = await supabaseAdmin
        .from("classes")
        .insert({
          faculty_id: facultyProfile.id,
          course_id: courseId,
          course: `PIPE-${TS}`,
          section: "T",
          name: "Pipeline Test Class",
          enroll_code: `PIPE-${TS}`,
        })
        .select("id")
        .single();
      if (clsErr || !newClass) {
        throw new Error(`Failed to create fixture class: ${clsErr?.message}`);
      }
      fixtureClassId = newClass.id;
      classId = newClass.id;
    }

    /* create an isolated test session */
    const { error: sessionErr } = await supabaseAdmin.from("sessions").upsert(
      {
        id: TEST_SESSION_ID,
        class_id: classId,
        course_id: courseId,
        topic: "Pipeline Integration Test Session",
        status: "active",
        ilo_ids: iloIds,
        last_analyzed_at: null,
      },
      { onConflict: "id" },
    );

    if (sessionErr) {
      throw new Error(`Failed to create test session: ${sessionErr.message}`);
    }

    /* create 3 feedback entries */
    const feedbackEntries = [
      { session_id: TEST_SESSION_ID, content: "The lesson was too fast and I couldn't follow." },
      { session_id: TEST_SESSION_ID, content: "More examples please, the topic is confusing." },
      {
        session_id: TEST_SESSION_ID,
        content: "The seatwork was manageable but the lecture part was hard.",
      },
    ];

    const { data: insertedFeedback, error: fbErr } = await supabaseAdmin
      .from("feedback")
      .insert(feedbackEntries)
      .select("id");

    if (fbErr || !insertedFeedback) {
      throw new Error(`Failed to insert test feedback: ${fbErr?.message}`);
    }

    testFeedbackIds = insertedFeedback.map((f) => f.id);

    /* config the mock to return raw diagnostics referencing our feedback IDs */
    mockRunInference.mockResolvedValue(buildMockOutput(testFeedbackIds));

    /* sign in as faculty so runAnalysisPipeline() passes RLS */
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
    await closeAdminSqlClient();
  });

  /* Tests */
  it("1. runAnalysisPipeline() fetches session data correctly and returns a result", async () => {
    const result = await runAnalysisPipeline(TEST_SESSION_ID);

    expect(result).not.toBeNull();
    expect(result.sessionId).toBe(TEST_SESSION_ID);
    expect(result.totalFeedback).toBe(testFeedbackIds.length);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(mockPreload).toHaveBeenCalledOnce();
    expect(mockRunInference).toHaveBeenCalledOnce();
  });

  it("2. pipeline saves raw ML output to analysis_results and computed result to feedback_diagnostics", async () => {
    /* analysis_results — one row per feedback with issue/polarity */
    const { data: ar } = await supabaseAdmin
      .from("analysis_results")
      .select("*")
      .eq("session_id", TEST_SESSION_ID);

    expect(ar).not.toBeNull();
    expect(ar!.length).toBe(testFeedbackIds.length);
    for (const row of ar!) {
      expect(row.feedback_id).toBeTruthy();
      expect(typeof row.issue).toBe("string");
      expect(["pos", "neu", "neg"]).toContain(row.polarity);
    }

    /* feedback_diagnostics — single JSONB cache row */
    const { data: diag } = await supabaseAdmin
      .from("feedback_diagnostics")
      .select("*")
      .eq("session_id", TEST_SESSION_ID);

    expect(diag).not.toBeNull();
    expect(diag!.length).toBe(1);
    expect(diag![0].result).toBeTruthy();
    expect(typeof diag![0].rules_version).toBe("string");
    expect(diag![0].rules_version.length).toBeGreaterThan(0);

    /* last_analyzed_at */
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("last_analyzed_at")
      .eq("id", TEST_SESSION_ID)
      .single();

    expect(session!.last_analyzed_at).not.toBeNull();
    expect(new Date(session!.last_analyzed_at).getTime()).not.toBeNaN();
  });

  it("3. fetchComputedResult() retrieves saved results", async () => {
    const result = await fetchComputedResult(TEST_SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe(TEST_SESSION_ID);
    expect(result!.totalFeedback).toBe(testFeedbackIds.length);
    expect(result!.recommendations.length).toBeGreaterThan(0);
    expect(result!.aspectDist.length).toBeGreaterThan(0);
    expect(result!.polarityDist.length).toBe(3);
    expect(result!.issueDist.length).toBeGreaterThan(0);
  });

  it("4. analysis_results rows match expected raw schema", async () => {
    const { data: ar } = await supabaseAdmin
      .from("analysis_results")
      .select("*")
      .eq("session_id", TEST_SESSION_ID);

    expect(ar).not.toBeNull();
    expect(ar!.length).toBeGreaterThan(0);

    const validPolarities = new Set(["pos", "neu", "neg"]);

    for (const record of ar!) {
      expect(record.feedback_id).toBeTruthy();
      expect(record.session_id).toBe(TEST_SESSION_ID);
      expect(typeof record.issue).toBe("string");
      expect(record.issue.length).toBeGreaterThan(0);
      expect(validPolarities.has(record.polarity)).toBe(true);
    }
  });

  it("5. re-analysis overwrites previous results cleanly", async () => {
    /* run twice */
    await runAnalysisPipeline(TEST_SESSION_ID);
    await runAnalysisPipeline(TEST_SESSION_ID);

    /* still exactly N analysis_results rows (one per feedback, not accumulating) */
    const { data: ar } = await supabaseAdmin
      .from("analysis_results")
      .select("id", { count: "exact" })
      .eq("session_id", TEST_SESSION_ID);

    expect(ar).not.toBeNull();
    expect(ar!.length).toBe(testFeedbackIds.length);

    /* still exactly 1 feedback_diagnostics row */
    const { data: diag } = await supabaseAdmin
      .from("feedback_diagnostics")
      .select("id", { count: "exact" })
      .eq("session_id", TEST_SESSION_ID);

    expect(diag).not.toBeNull();
    expect(diag!.length).toBe(1);
  });
});
