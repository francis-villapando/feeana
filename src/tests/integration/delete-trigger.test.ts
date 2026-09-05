import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../helpers/supabaseAdmin";
import { adminExec, closeAdminSqlClient } from "../../lib/db/adminSql";

const TEST_SESSION_ID = "f1234567-1234-4321-abcd-000000000002";
const FACULTY_EMAIL = "faculty@test.com";
const FACULTY_PASSWORD = "faculty123";

const supabaseAnon = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

describe("prevent_delete trigger bypass", () => {
  let facultyId: string;
  let testClassId: string;
  let testCourseId: string;
  let insertedSessionId: string;

  beforeAll(async () => {
    const { data: faculty } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", FACULTY_EMAIL)
      .maybeSingle();

    if (!faculty) {
      throw new Error(`Faculty profile for ${FACULTY_EMAIL} not found. Ensure seed data has been run.`);
    }
    facultyId = faculty.id;

    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .insert({ code: `TRIG-${Date.now()}`, title: "Trigger Test Course" })
      .select("id")
      .single();

    if (courseErr || !course) {
      throw new Error(`Failed to create fixture course: ${courseErr?.message}`);
    }
    testCourseId = course.id;

    const { data: cls, error: clsErr } = await supabaseAdmin
      .from("classes")
      .insert({
        faculty_id: facultyId,
        course_id: testCourseId,
        course: "TRIG-TEST",
        section: "T",
        name: "Trigger Test Class",
        enroll_code: `TRIG-${Date.now()}`,
      })
      .select("id")
      .single();

    if (clsErr || !cls) {
      throw new Error(`Failed to create fixture class: ${clsErr?.message}`);
    }
    testClassId = cls.id;
  });

  afterAll(async () => {
    if (insertedSessionId) {
      await adminExec([{ text: "DELETE FROM sessions WHERE id = $1", params: [insertedSessionId] }]);
    }
    if (testClassId) {
      await supabaseAdmin.from("classes").delete().eq("id", testClassId);
    }
    if (testCourseId) {
      await supabaseAdmin.from("courses").delete().eq("id", testCourseId);
    }
    await closeAdminSqlClient();
  });

  it("service_role can delete from protected tables", async () => {
    const { data: inserted } = await supabaseAdmin
      .from("sessions")
      .insert({
        class_id: testClassId,
        course_id: testCourseId,
        topic: "trigger-test",
        status: "active",
        ilo_ids: [],
      })
      .select("id")
      .single();

    expect(inserted).not.toBeNull();
    insertedSessionId = inserted!.id;

    const { error } = await supabaseAdmin.from("sessions").delete().eq("id", inserted!.id);

    expect(error).toBeNull();
  });

  it("faculty owner is blocked by trigger (not RLS) on protected tables", async () => {
    const { error: signInErr } = await supabaseAnon.auth.signInWithPassword({
      email: FACULTY_EMAIL,
      password: FACULTY_PASSWORD,
    });
    expect(signInErr).toBeNull();

    const { data: inserted } = await supabaseAdmin
      .from("sessions")
      .insert({
        class_id: testClassId,
        course_id: testCourseId,
        topic: "trigger-block-test",
        status: "active",
        ilo_ids: [],
      })
      .select("id")
      .single();

    expect(inserted).not.toBeNull();
    const blockTestId = inserted!.id;

    const { error } = await supabaseAnon.from("sessions").delete().eq("id", blockTestId);

    expect(error).not.toBeNull();

    await supabaseAnon.auth.signOut();

    await adminExec([{ text: "DELETE FROM sessions WHERE id = $1", params: [blockTestId] }]);
  });
});
