import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../helpers/supabaseAdmin";

/* Constants */
let KNOWN_SESSION_ID = "3da770a1-ca05-422c-9b6b-c85f2f92dc4e";

const FACULTY_EMAIL = "faculty@test.com";
const FACULTY_PASSWORD = "faculty123";

const STUDENT_EMAIL = "student@test.com";
const STUDENT_PASSWORD = "student123";

/* Mutable suite-level state */
let fixtureCourseId: string;
let fixtureClassId: string;
let fixtureSessionId: string;
let tempFacultyEmail: string;
let tempFacultyId: string;

const supabaseAnon = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

/* Helpers */
async function clearTestDiagnostics(): Promise<void> {
  if (fixtureSessionId) {
    await supabaseAdmin.from("feedback_diagnostics").delete().eq("session_id", fixtureSessionId);
  }
}

async function seedFixtureDiagnostic(): Promise<void> {
  if (fixtureSessionId) {
    await supabaseAdmin.from("feedback_diagnostics").upsert(
      {
        session_id: fixtureSessionId,
        result: { test: "Fixture diagnostic for RLS validation" },
        rules_version: "1.0.0",
      },
      { onConflict: "session_id" },
    );
  }
}

/* Suite */
describe("RLS: feedback_diagnostics table", () => {
  beforeAll(async () => {
    /* verify env */
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    }

    /* resolve faculty owner profile */
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

    /* create dedicated fixture course and class owned by faculty@test.com */
    const TS = Date.now();
    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .insert({ code: `RLS-${TS}`, title: "RLS Diagnostics Test Course" })
      .select("id")
      .single();

    if (courseErr || !course) {
      throw new Error(`Failed to create fixture course: ${courseErr?.message}`);
    }
    fixtureCourseId = course.id;

    const { data: cls, error: clsErr } = await supabaseAdmin
      .from("classes")
      .insert({
        faculty_id: facultyProfile.id,
        course_id: fixtureCourseId,
        course: `RLS-${TS}`,
        section: "RLS-SEC",
        name: "RLS Diagnostics Test Class",
        enroll_code: `RLS-${TS}`,
      })
      .select("id")
      .single();

    if (clsErr || !cls) {
      throw new Error(`Failed to create fixture class: ${clsErr?.message}`);
    }
    fixtureClassId = cls.id;

    /* create dedicated fixture session owned by faculty@test.com */
    const { data: session, error: sessErr } = await supabaseAdmin
      .from("sessions")
      .insert({
        class_id: fixtureClassId,
        course_id: fixtureCourseId,
        topic: "RLS Test Session",
        status: "active",
        ilo_ids: [],
      })
      .select("id")
      .single();

    if (sessErr || !session) {
      throw new Error(`Failed to create fixture session: ${sessErr?.message}`);
    }
    fixtureSessionId = session.id;
    KNOWN_SESSION_ID = session.id;

    /* create temp non-owning faculty user */
    tempFacultyEmail = `test-nonowner-${TS}@test.com`;

    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: tempFacultyEmail,
      password: "tempFacultyPass123",
      email_confirm: true,
    });

    if (createErr) {
      throw new Error(`Failed to create temp faculty user: ${createErr.message}`);
    }
    tempFacultyId = createdUser.user.id;

    /* ensure a profile row exists for the temp user */
    await supabaseAdmin.from("profiles").upsert(
      {
        id: tempFacultyId,
        email: tempFacultyEmail,
        full_name: "Temp Non-Owning Faculty",
        role: "faculty",
      },
      { onConflict: "id" },
    );

    /* clear any leftover diagnostics */
    await clearTestDiagnostics();
  });

  afterAll(async () => {
    /* remove all test-inserted diagnostics */
    await clearTestDiagnostics();

    /* delete temp faculty user */
    if (tempFacultyId) {
      await supabaseAdmin.auth.admin.deleteUser(tempFacultyId);
    }

    /* delete created session, class, course */
    if (fixtureSessionId) {
      await supabaseAdmin.from("sessions").delete().eq("id", fixtureSessionId);
    }
    if (fixtureClassId) {
      await supabaseAdmin.from("classes").delete().eq("id", fixtureClassId);
    }
    if (fixtureCourseId) {
      await supabaseAdmin.from("courses").delete().eq("id", fixtureCourseId);
    }
  });

  /* after each test, reset fixture state */
  afterEach(async () => {
    await clearTestDiagnostics();
    await seedFixtureDiagnostic();
  });

  /* Faculty owner */
  describe("Faculty owner (faculty@test.com)", () => {
    beforeAll(async () => {
      const { error } = await supabaseAnon.auth.signInWithPassword({
        email: FACULTY_EMAIL,
        password: FACULTY_PASSWORD,
      });
      if (error) {
        throw new Error(`Sign-in failed for ${FACULTY_EMAIL}: ${error.message}`);
      }
    });

    afterAll(async () => {
      await supabaseAnon.auth.signOut();
    });

    it("1. can INSERT diagnostics for their own session", async () => {
      const { data, error } = await supabaseAnon
        .from("feedback_diagnostics")
        .upsert(
          {
            session_id: KNOWN_SESSION_ID,
            result: { test: "Inserted by owner during RLS test" },
            rules_version: "1.0.0",
          },
          { onConflict: "session_id" },
        )
        .select();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });

    it("2. can SELECT diagnostics for their own session", async () => {
      const { data, error } = await supabaseAnon
        .from("feedback_diagnostics")
        .select("*")
        .eq("session_id", KNOWN_SESSION_ID);

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });

    it("3. can DELETE diagnostics for their own session", async () => {
      const { error } = await supabaseAnon
        .from("feedback_diagnostics")
        .delete()
        .eq("session_id", KNOWN_SESSION_ID);

      expect(error).toBeNull();
    });
  });

  /* Non-owning faculty */
  describe("Non-owning faculty", () => {
    beforeAll(async () => {
      const { error } = await supabaseAnon.auth.signInWithPassword({
        email: tempFacultyEmail,
        password: "tempFacultyPass123",
      });
      if (error) {
        throw new Error(`Sign-in failed for temp faculty: ${error.message}`);
      }
    });

    afterAll(async () => {
      await supabaseAnon.auth.signOut();
    });

    it("4. CANNOT SELECT diagnostics for another faculty's session", async () => {
      const { data, error } = await supabaseAnon
        .from("feedback_diagnostics")
        .select("*")
        .eq("session_id", KNOWN_SESSION_ID);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("5. CANNOT INSERT diagnostics for another faculty's session", async () => {
      const { error } = await supabaseAnon.from("feedback_diagnostics").insert({
        session_id: KNOWN_SESSION_ID,
        result: { test: "Should be rejected by RLS" },
        rules_version: "1.0.0",
      });

      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toMatch(/(?:row-level security|policy|violates)/i);
    });
  });

  /* Student */
  describe("Student (student@test.com)", () => {
    beforeAll(async () => {
      const { error } = await supabaseAnon.auth.signInWithPassword({
        email: STUDENT_EMAIL,
        password: STUDENT_PASSWORD,
      });
      if (error) {
        throw new Error(`Sign-in failed for ${STUDENT_EMAIL}: ${error.message}`);
      }
    });

    afterAll(async () => {
      await supabaseAnon.auth.signOut();
    });

    it("6. CANNOT access diagnostics at all", async () => {
      const { data, error } = await supabaseAnon
        .from("feedback_diagnostics")
        .select("*")
        .eq("session_id", KNOWN_SESSION_ID);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
