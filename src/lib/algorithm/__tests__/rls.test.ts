import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const KNOWN_SESSION_ID = "3da770a1-ca05-422c-9b6b-c85f2f92dc4e";

const FACULTY_EMAIL = "faculty@test.com";
const FACULTY_PASSWORD = "faculty123";

const STUDENT_EMAIL = "student@test.com";
const STUDENT_PASSWORD = "student123";

const TEST_TTI_PREFIX = "RLS-TEST-";

/* ------------------------------------------------------------------ */
/*  Mutable suite-level state                                         */
/* ------------------------------------------------------------------ */

let fixtureFeedbackId: string;
let tempFacultyEmail: string;
let tempFacultyId: string;

const supabaseAnon = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeTestTti(label: string): string {
  return `${TEST_TTI_PREFIX}${label}`;
}

async function clearTestDiagnostics(): Promise<void> {
  await supabaseAdmin
    .from("feedback_diagnostics")
    .delete()
    .eq("session_id", KNOWN_SESSION_ID)
    .ilike("tti", `${TEST_TTI_PREFIX}%`);
}

async function seedFixtureDiagnostic(): Promise<void> {
  await supabaseAdmin.from("feedback_diagnostics").insert({
    feedback_id: fixtureFeedbackId,
    session_id: KNOWN_SESSION_ID,
    tti: makeTestTti("Fixture"),
    rbt: 3,
    clt: "Intrinsic",
    issue: "Fixture diagnostic for RLS validation",
    polarity: "neu",
    is_gap: false,
  });
}

/* ------------------------------------------------------------------ */
/*  Suite                                                              */
/* ------------------------------------------------------------------ */

describe("RLS: feedback_diagnostics table", () => {
  beforeAll(async () => {
    /* ---- verify env ---- */
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    }

    /* ---- resolve a feedback_id from seed data ---- */
    const { data: feedbackRow, error: fbErr } = await supabaseAdmin
      .from("feedback")
      .select("id")
      .eq("session_id", KNOWN_SESSION_ID)
      .limit(1)
      .single();

    if (fbErr || !feedbackRow) {
      throw new Error(
        `No feedback found for session ${KNOWN_SESSION_ID}. ` +
        "Ensure supabase/seed.sql has been run against the database.",
      );
    }
    fixtureFeedbackId = feedbackRow.id;

    /* ---- create temp non-owning faculty user ---- */
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

    /* ---- ensure a profile row exists for the temp user ---- */
    await supabaseAdmin.from("profiles").upsert(
      {
        id: tempFacultyId,
        email: tempFacultyEmail,
        full_name: "Temp Non-Owning Faculty",
        role: "faculty",
      },
      { onConflict: "id" },
    );

    /* ---- seed fixture diagnostics ---- */
    await clearTestDiagnostics();
    await seedFixtureDiagnostic();
  });

  afterAll(async () => {
    /* ---- remove all test-inserted diagnostics ---- */
    await clearTestDiagnostics();

    /* ---- delete temp faculty user ---- */
    if (tempFacultyId) {
      await supabaseAdmin.auth.admin.deleteUser(tempFacultyId);
    }
  });

  /* ---- after each test, reset fixture state ---- */
  afterEach(async () => {
    await clearTestDiagnostics();
    await seedFixtureDiagnostic();
  });

  /* ================================================================ */
  /*  Faculty owner                                                   */
  /* ================================================================ */

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
        .insert({
          feedback_id: fixtureFeedbackId,
          session_id: KNOWN_SESSION_ID,
          tti: makeTestTti("Owner-INSERT"),
          rbt: 4,
          clt: "Extraneous",
          issue: "Inserted by owner during RLS test",
          polarity: "neg",
          is_gap: true,
        })
        .select();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data![0].tti).toBe(makeTestTti("Owner-INSERT"));
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
        .eq("session_id", KNOWN_SESSION_ID)
        .ilike("tti", `${TEST_TTI_PREFIX}%`);

      expect(error).toBeNull();
    });
  });

  /* ================================================================ */
  /*  Non-owning faculty                                              */
  /* ================================================================ */

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
          feedback_id: fixtureFeedbackId,
          session_id: KNOWN_SESSION_ID,
          tti: makeTestTti("NonOwner-INSERT"),
          rbt: 2,
          clt: "Intrinsic",
          issue: "Should be rejected by RLS",
          polarity: "pos",
          is_gap: false,
        });

      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toMatch(/(?:row-level security|policy)/i);
    });
  });

  /* ================================================================ */
  /*  Student                                                         */
  /* ================================================================ */

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
