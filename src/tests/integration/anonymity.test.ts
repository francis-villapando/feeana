import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../helpers/supabaseAdmin";

/* Constants */
const STUDENT_EMAIL = "student@test.com";
const STUDENT_PASSWORD = "student123";

/* Mutable suite-level state */
let studentId: string;
let facultyId: string;
let courseId: string;
let classId: string;
let sessionId: string;
let createdFeedbackId: string;

const supabaseAnon = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

describe("Anonymity: decoupled participation & anonymous feedback", () => {
  beforeAll(async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", STUDENT_EMAIL)
      .maybeSingle();
    if (!profile) throw new Error("Student profile not found. Ensure seed data has been run.");
    studentId = profile.id;

    // Build a self-contained fixture: faculty, course, class, active session, enrollment.
    const { data: faculty } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", "faculty@test.com")
      .maybeSingle();
    if (!faculty) throw new Error("Faculty profile not found. Ensure seed data has been run.");
    facultyId = faculty.id;

    const { data: course } = await supabaseAdmin
      .from("courses")
      .insert({ code: `ANON-${Date.now()}`, title: "Anonymity Test Course" })
      .select("id, code")
      .single();
    courseId = course!.id;

    const { data: cls } = await supabaseAdmin
      .from("classes")
      .insert({
        faculty_id: facultyId,
        course_id: courseId,
        course: course!.code,
        section: "T",
        name: "Anonymity Test Class",
        enroll_code: `ANON-${Date.now()}`,
      })
      .select("id")
      .single();
    classId = cls!.id;

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .insert({
        class_id: classId,
        course_id: courseId,
        topic: "Anonymity Test Session",
        status: "active",
        starts_at: new Date(Date.now() - 3600000).toISOString(),
        ends_at: new Date(Date.now() + 3600000).toISOString(),
      })
      .select("id")
      .single();
    sessionId = session!.id;

    const { error: enrollErr } = await supabaseAdmin.from("enrollments").insert({
      class_id: classId,
      student_id: studentId,
    });
    if (enrollErr) throw new Error(`Failed to enroll student: ${enrollErr.message}`);

    const { error } = await supabaseAnon.auth.signInWithPassword({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    });
    if (error) throw new Error(`Sign-in failed for ${STUDENT_EMAIL}: ${error.message}`);
  });

  afterAll(async () => {
    await supabaseAnon.auth.signOut();

    // Clean up rows created by this suite.
    if (createdFeedbackId) {
      await supabaseAdmin.from("feedback").delete().eq("id", createdFeedbackId);
    }
    if (sessionId) {
      await supabaseAdmin.from("session_participations").delete().eq("session_id", sessionId);
      await supabaseAdmin.from("sessions").delete().eq("id", sessionId);
    }
    if (classId) {
      await supabaseAdmin.from("enrollments").delete().eq("class_id", classId);
      await supabaseAdmin.from("classes").delete().eq("id", classId);
    }
    if (courseId) {
      await supabaseAdmin.from("courses").delete().eq("id", courseId);
    }
  });

  it("1. submits feedback via RPC and stores an anonymous feedback row", async () => {
    const { data: feedbackId, error } = await supabaseAnon.rpc("submit_anonymous_feedback", {
      p_session_id: sessionId,
      p_content: "Maganda po ang discussion ngayon, malinaw ang examples.",
      p_meta: { cleanedText: "maganda po ang discussion ngayon, malinaw ang examples." },
    });

    expect(error).toBeNull();
    expect(feedbackId).toBeTruthy();
    createdFeedbackId = feedbackId as string;

    // The feedback row must carry zero student identity.
    const { data: fb, error: fbErr } = await supabaseAdmin
      .from("feedback")
      .select("id, session_id, content, meta, created_at")
      .eq("id", feedbackId)
      .single();

    expect(fbErr).toBeNull();
    expect(fb).not.toBeNull();
    expect(fb!.session_id).toBe(sessionId);
    expect(fb!.meta).not.toHaveProperty("submittedBy");
    expect(fb!.meta).not.toHaveProperty("student_id");
    expect(Object.keys(fb!)).not.toContain("student_id");
  });

  it("2. records a participation row for the student", async () => {
    const { data, error } = await supabaseAdmin
      .from("session_participations")
      .select("session_id, student_id")
      .eq("session_id", sessionId)
      .eq("student_id", studentId);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("3. rejects a second submission with already_submitted", async () => {
    const { data, error } = await supabaseAnon.rpc("submit_anonymous_feedback", {
      p_session_id: sessionId,
      p_content: "Second attempt should fail.",
      p_meta: { cleanedText: "second attempt should fail." },
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("already_submitted");
  });

  it("4. student can view only their own participation", async () => {
    const { data, error } = await supabaseAnon
      .from("session_participations")
      .select("session_id")
      .eq("session_id", sessionId);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    // The student sees their own participation row.
    expect(data!.length).toBeGreaterThan(0);
  });
});
