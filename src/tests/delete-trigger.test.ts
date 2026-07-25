import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin";
import { adminExec, closeAdminSqlClient } from "../../scripts/admin-sql";

const TEST_SESSION_ID = "f1234567-1234-4321-abcd-000000000002";
const FACULTY_EMAIL = "faculty@test.com";
const FACULTY_PASSWORD = "faculty123";

const supabaseAnon = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

describe("prevent_delete trigger bypass", () => {
  let testClassId: string;
  let testCourseId: string;
  let testIloIds: string[];
  let insertedSessionId: string;

  beforeAll(async () => {
    const { data: classRow } = await supabaseAdmin
      .from("classes")
      .select("id, course_id")
      .eq("section", "3CS-C")
      .eq("course", "CSEG2")
      .single();
    testClassId = classRow!.id;
    testCourseId = classRow!.course_id;

    const { data: ilos } = await supabaseAdmin
      .from("ilos")
      .select("id")
      .eq("course_id", testCourseId);
    testIloIds = (ilos ?? []).map((i) => i.id);
  });

  afterAll(async () => {
    await adminExec([{ text: "DELETE FROM sessions WHERE id = $1", params: [insertedSessionId] }]);
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
        ilo_ids: testIloIds,
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
        ilo_ids: testIloIds,
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
