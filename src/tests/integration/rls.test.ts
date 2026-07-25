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
let fixtureFeedbackId: string;
let tempFacultyEmail: string;
let tempFacultyId: string;

const supabaseAnon = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

/* Helpers */
async function clearTestDiagnostics(): Promise<void> {
  await supabaseAdmin
    .from("feedback_diagnostics")
    .delete()
    .eq("session_id", KNOWN_SESSION_ID);
}

async function seedFixtureDiagnostic(): Promise<void> {
  await supabaseAdmin.from("feedback_diagnostics").upsert(
    {
      session_id: KNOWN_SESSION_ID,
      result: { test: "Fixture diagnostic for RLS validation" },
      rules_version: "1.0.0",
    },
    { onConflict: "session_id" },
  );
}

/* Suite */
describe("RLS: feedback_diagnostics table", () => {
  beforeAll(async () => {
    /* verify env */
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    }

    /* resolve a feedback_id from seed data */
    let { data: feedbackRow } = await supabaseAdmin
      .from("feedback")
      .select("id, session_id")
      .eq("session_id", KNOWN_SESSION_ID)
      .limit(1)
      .maybeSingle();

    if (!feedbackRow) {
      const { data: anyFb } = await supabaseAdmin
        .from("feedback")
        .select("id, session_id")
        .limit(1)
        .maybeSingle();
      if (!anyFb) {
        throw new Error("No feedback found in database. Ensure seed data has been run.");
      }
      feedbackRow = anyFb;
      KNOWN_SESSION_ID = anyFb.session_id;
    }
    fixtureFeedbackId = feedbackRow.id;

    /* create temp non-owning faculty user */
    const TS = Date.now();
    tempFacultyEmail = `test-nonowner-${TS}@test.com`;

    const { data: createdUser, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
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

    /* seed fixture diagnostics */
    await clearTestDiagnostics();
    await seedFixtureDiagnostic();
  });

  afterAll(async () => {
    /* remove all test-inserted diagnostics */
    await clearTestDiagnostics();

    /* delete temp faculty user */
    if (tempFacultyId) {
      await supabaseAdmin.auth.admin.deleteUser(tempFacultyId);
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
      const { error } = await supabaseAnon
        .from("feedback_diagnostics")
        .insert({
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
