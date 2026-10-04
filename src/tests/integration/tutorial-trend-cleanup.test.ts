import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../helpers/supabaseAdmin";

const FACULTY_EMAIL = "faculty@test.com";
const FACULTY_PASSWORD = "faculty123";
const STUDENT_EMAIL = "student@test.com";
const STUDENT_PASSWORD = "student123";
const DAY_MS = 24 * 60 * 60 * 1000;

const supabaseAnon = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

describe("tutorial trend session cleanup", () => {
  let facultyId: string;
  let classId: string;
  let regularClassId: string;
  let courseId: string;
  let baseSessionId: string;
  let regularBaseSessionId: string;
  let generatedSessionIds: string[];
  let unrelatedSessionId: string;
  let feedbackIds: string[];
  let diagnosticIds: string[];

  beforeAll(async () => {
    const { data: faculty, error: facultyError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", FACULTY_EMAIL)
      .single();
    if (facultyError || !faculty) {
      throw new Error(`Faculty fixture unavailable: ${facultyError?.message}`);
    }
    facultyId = faculty.id;

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .insert({ code: `TRENDCLEAN-${Date.now()}`, title: "Tutorial Trend Cleanup Test" })
      .select("id, code")
      .single();
    if (courseError || !course) {
      throw new Error(`Failed to create test course: ${courseError?.message}`);
    }
    courseId = course.id;

    const { data: tutorialClass, error: classError } = await supabaseAdmin
      .from("classes")
      .insert({
        faculty_id: facultyId,
        course_id: courseId,
        course: course.code,
        section: "T",
        name: "Tutorial Trend Cleanup Test",
        enroll_code: `TRENDCLEAN-${Date.now()}`,
        is_tutorial: true,
      })
      .select("id")
      .single();
    if (classError || !tutorialClass) {
      throw new Error(`Failed to create test class: ${classError?.message}`);
    }
    classId = tutorialClass.id;

    const { data: regularClass, error: regularClassError } = await supabaseAdmin
      .from("classes")
      .insert({
        faculty_id: facultyId,
        course_id: courseId,
        course: course.code,
        section: "R",
        name: "Regular Trend Cleanup Test",
        enroll_code: `TRENDCLEAN-REG-${Date.now()}`,
      })
      .select("id")
      .single();
    if (regularClassError || !regularClass) {
      throw new Error(`Failed to create regular test class: ${regularClassError?.message}`);
    }
    regularClassId = regularClass.id;

    const baseEndsAt = new Date(Date.now() - 10 * DAY_MS);
    const baseStartsAt = new Date(baseEndsAt.getTime() - DAY_MS);
    const baseTopic = "Tutorial Trend Cleanup Base";
    const { data: sessions, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert([
        {
          class_id: classId,
          course_id: courseId,
          topic: baseTopic,
          status: "closed",
          starts_at: baseStartsAt.toISOString(),
          ends_at: baseEndsAt.toISOString(),
          created_by: facultyId,
          ilo_ids: [],
        },
        ...[
          { suffix: "Session 2", start: 1, end: 2 },
          { suffix: "Session 3", start: 3, end: 4 },
          { suffix: "Unrelated Session", start: 5, end: 6 },
        ].map(({ suffix, start, end }) => ({
          class_id: classId,
          course_id: courseId,
          topic: suffix === "Unrelated Session" ? suffix : `${baseTopic} (${suffix})`,
          status: "closed",
          starts_at: new Date(baseEndsAt.getTime() + start * DAY_MS).toISOString(),
          ends_at: new Date(baseEndsAt.getTime() + end * DAY_MS).toISOString(),
          created_by: facultyId,
          ilo_ids: [],
        })),
        {
          class_id: regularClassId,
          course_id: courseId,
          topic: "Regular Class Base Session",
          status: "closed",
          starts_at: baseStartsAt.toISOString(),
          ends_at: baseEndsAt.toISOString(),
          created_by: facultyId,
          ilo_ids: [],
        },
      ])
      .select("id, topic");
    if (sessionError || !sessions || sessions.length !== 5) {
      throw new Error(`Failed to create test sessions: ${sessionError?.message}`);
    }

    baseSessionId = sessions.find((session) => session.topic === baseTopic)!.id;
    regularBaseSessionId = sessions.find(
      (session) => session.topic === "Regular Class Base Session",
    )!.id;
    generatedSessionIds = sessions
      .filter(
        (session) =>
          session.topic === `${baseTopic} (Session 2)` ||
          session.topic === `${baseTopic} (Session 3)`,
      )
      .map((session) => session.id);
    unrelatedSessionId = sessions.find((session) => session.topic === "Unrelated Session")!.id;

    const { data: feedbackRows, error: feedbackError } = await supabaseAdmin
      .from("feedback")
      .insert(
        generatedSessionIds.map((session_id) => ({
          session_id,
          content: "Tutorial trend cleanup test feedback",
          meta: {},
        })),
      )
      .select("id, session_id");
    if (feedbackError || !feedbackRows || feedbackRows.length !== generatedSessionIds.length) {
      throw new Error(`Failed to create test feedback: ${feedbackError?.message}`);
    }
    feedbackIds = feedbackRows.map(({ id }) => id);

    const { data: diagnosticRows, error: diagnosticError } = await supabaseAdmin
      .from("feedback_diagnostics")
      .insert(
        feedbackRows.map(({ session_id }) => ({
          session_id,
          result: {},
          rules_version: "test",
        })),
      )
      .select("id");
    if (
      diagnosticError ||
      !diagnosticRows ||
      diagnosticRows.length !== generatedSessionIds.length
    ) {
      throw new Error(`Failed to create test diagnostics: ${diagnosticError?.message}`);
    }
    diagnosticIds = diagnosticRows.map(({ id }) => id);
  });

  afterAll(async () => {
    await supabaseAnon.auth.signOut();
    if (classId) await supabaseAdmin.from("classes").delete().eq("id", classId);
    if (regularClassId) await supabaseAdmin.from("classes").delete().eq("id", regularClassId);
    if (courseId) await supabaseAdmin.from("courses").delete().eq("id", courseId);
  });

  it("deletes only generated trend sessions for the owned tutorial class", async () => {
    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: FACULTY_EMAIL,
      password: FACULTY_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { error } = await supabaseAnon.rpc("delete_tutorial_trend_sessions", {
      p_class_id: classId,
      p_base_session_id: baseSessionId,
    });
    expect(error).toBeNull();

    const { data: remaining, error: selectError } = await supabaseAdmin
      .from("sessions")
      .select("id")
      .in("id", [baseSessionId, ...generatedSessionIds, unrelatedSessionId]);
    expect(selectError).toBeNull();
    expect(remaining?.map(({ id }) => id).sort()).toEqual(
      [baseSessionId, unrelatedSessionId].sort(),
    );

    const { data: remainingFeedback, error: feedbackError } = await supabaseAdmin
      .from("feedback")
      .select("id")
      .in("id", feedbackIds);
    expect(feedbackError).toBeNull();
    expect(remainingFeedback).toEqual([]);

    const { data: remainingDiagnostics, error: diagnosticError } = await supabaseAdmin
      .from("feedback_diagnostics")
      .select("id")
      .in("id", diagnosticIds);
    expect(diagnosticError).toBeNull();
    expect(remainingDiagnostics).toEqual([]);
  });

  it("rejects unauthenticated cleanup requests", async () => {
    await supabaseAnon.auth.signOut();
    const { error } = await supabaseAnon.rpc("delete_tutorial_trend_sessions", {
      p_class_id: classId,
      p_base_session_id: baseSessionId,
    });
    expect(error?.code).toBe("42501");
  });

  it("rejects callers who do not own the tutorial class", async () => {
    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { error } = await supabaseAnon.rpc("delete_tutorial_trend_sessions", {
      p_class_id: classId,
      p_base_session_id: baseSessionId,
    });
    expect(error?.code).toBe("42501");
  });

  it("rejects cleanup for a class that is not tutorial-tagged", async () => {
    await supabaseAnon.auth.signOut();
    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: FACULTY_EMAIL,
      password: FACULTY_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { error } = await supabaseAnon.rpc("delete_tutorial_trend_sessions", {
      p_class_id: regularClassId,
      p_base_session_id: regularBaseSessionId,
    });
    expect(error?.code).toBe("42501");
  });
});
