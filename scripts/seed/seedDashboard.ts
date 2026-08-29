import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { adminExec, closeAdminSqlClient } from "../../src/lib/db/adminSql";
import {
  CalculateDistributions,
  GeneratePedagogicalCue,
} from "../../src/lib/algorithm/strategyGeneration";
import {
  TTI_RULES,
  RBT_RULES,
  RBT_LEVELS,
  CLT_RULES,
  ISSUE_RULES,
  RULES_VERSION,
} from "../../src/lib/algorithm/rules";
import type {
  SessionContext,
  DiagnosticRecord,
  BufferedDiagnostic,
  RecommendationItem,
} from "../../src/lib/algorithm/types";
import type {
  DistEntry,
  AnalysisResult,
  GapItem,
  RecommendationTerm,
  Theory,
} from "../../src/lib/types/types";

// Dashboard Test Seed — 1 Course, 2 Classes, 50 Students, 4 Sessions, 155 Feedback
//
// Usage: npx tsx --env-file .env scripts/seed/seedDashboard.ts
//
// Deterministic: every entity ID and timestamp is derived from a fixed seed.
// The only random part per run is which feedback rows are sampled from
// public/model-data/test.csv (50 / 40 / 30 / 35 per session).

type SeedSupabase = SupabaseClient;

interface CsvFeedbackRow {
  id: string;
  category: string;
  issue: string;
  polarity: string;
  source: string;
  language: string;
  text: string;
  reference: string;
  group_id: string;
  cleaned_text: string;
}

interface FeedbackSeed {
  id: string;
  sessionId: string;
  studentId: string;
  content: string;
  issue: string;
  polarity: "pos" | "neu" | "neg";
  createdAt: string;
}

interface SessionSeed {
  id: string;
  topic: string;
  topicId: string | null;
  iloIds: string[];
  startsAt: string;
  endsAt: string;
  status: string;
  lastAnalyzedAt: string | null;
}

interface ClassSeedConfig {
  label: string;
  courseCode: string;
  section: string;
  sessionTopics: string[];
  feedbackCounts: number[];
  recentCount: number;
}

type TopicIloMap = Map<string, { id: string; statement: string; bloomLevel: string }[]>;

class DashboardSeeder {
  private static readonly SEED_REFERENCE_DATE = new Date("2026-06-18T00:00:00Z");
  private static readonly BLOOM_LEVELS = {
    Remember: 1,
    Understand: 2,
    Apply: 3,
    Analyze: 4,
    Evaluate: 5,
    Create: 6,
  } as const;

  private static readonly COURSE_CODE = "TEST-COURSE-CODE";
  private static readonly COURSE_TITLE = "TEST Course Title";
  private static readonly TOPIC_TITLES = ["TEST Topic 1", "TEST Topic 2", "TEST Topic 3"];

  private static readonly ILO_DEFS: {
    topicTitle: string;
    statement: string;
    bloomLevel: string;
  }[] = [
    { topicTitle: "TEST Topic 1", statement: "TEST ILO 1", bloomLevel: "Remember" },
    { topicTitle: "TEST Topic 1", statement: "TEST ILO 2", bloomLevel: "Understand" },
    { topicTitle: "TEST Topic 1", statement: "TEST ILO 3", bloomLevel: "Apply" },
    { topicTitle: "TEST Topic 2", statement: "TEST ILO 4", bloomLevel: "Analyze" },
    { topicTitle: "TEST Topic 2", statement: "TEST ILO 5", bloomLevel: "Evaluate" },
    { topicTitle: "TEST Topic 2", statement: "TEST ILO 6", bloomLevel: "Create" },
    { topicTitle: "TEST Topic 3", statement: "TEST ILO 7", bloomLevel: "Understand" },
    { topicTitle: "TEST Topic 3", statement: "TEST ILO 8", bloomLevel: "Apply" },
    { topicTitle: "TEST Topic 3", statement: "TEST ILO 9", bloomLevel: "Analyze" },
  ];

  private static readonly STUDENT_COUNT = 50;
  private static readonly FACULTY_EMAIL = "faculty@test.com";

  private static readonly CLASS_CONFIGS: ClassSeedConfig[] = [
    {
      label: "TEST-CLASS",
      courseCode: "TESTCLS01",
      section: "1",
      sessionTopics: ["TEST Topic 1", "TEST Topic 2", "TEST Topic 3"],
      feedbackCounts: [50, 30, 30],
      recentCount: 10,
    },
    {
      label: "TEST-CLASS",
      courseCode: "TESTCLS02",
      section: "2",
      sessionTopics: ["TEST Topic 1"],
      feedbackCounts: [35],
      recentCount: 0,
    },
  ];

  // Classes created by the previous seed version, purged on every run.
  private static readonly LEGACY_COURSE_CODES = ["TEST-CSEG2", "TEST-CCS106", "TEST-CCS112"];

  private static readonly PRIORITY_THRESHOLD = 0.3;

  private supabase: SeedSupabase;
  private facultyId = "";
  private feedbackPool: CsvFeedbackRow[] = [];

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
      console.error("Run with: npx tsx --env-file .env scripts/seed/seedDashboard.ts");
      process.exit(1);
    }
    this.supabase = createClient(url, serviceKey);
  }

  private static seedId(namespace: string, ...parts: string[]): string {
    const hash = createHash("sha256")
      .update([namespace, ...parts].join(":"))
      .digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }

  async run(): Promise<void> {
    const totalSessions = DashboardSeeder.CLASS_CONFIGS.reduce(
      (s, c) => s + c.sessionTopics.length,
      0,
    );
    console.log("Dashboard Seed Script\n");
    console.log(
      `Target: ${DashboardSeeder.CLASS_CONFIGS.length} classes, ${DashboardSeeder.STUDENT_COUNT} students, ${totalSessions} sessions\n`,
    );

    console.log("[1] Faculty...");
    this.facultyId = await this.getFacultyId();
    console.log(`  ✓ Faculty: ${this.facultyId}`);

    console.log("[2] Purging previous test data...");
    await this.cleanupAllTestData();
    console.log("  ✓ Legacy and current test classes removed");

    console.log("[3] Course, topics, ILOs...");
    const courseId = await this.getOrCreateCourse();
    const topics = await this.getOrCreateTopics(courseId);
    const ilos = await this.getOrCreateIlos(courseId, topics);
    const ilosByTopic: TopicIloMap = new Map();
    for (const topic of topics) {
      ilosByTopic.set(
        topic.title,
        ilos.filter((ilo) => ilo.topicId === topic.id),
      );
    }
    console.log(`  ✓ Course: ${DashboardSeeder.COURSE_CODE}`);
    console.log(`  ✓ ${topics.length} topics, ${ilos.length} ILOs`);

    console.log("[4] Students...");
    const studentIds = await this.createStudents();

    console.log("[5] Loading feedback pool from public/model-data/test.csv...");
    await this.loadFeedbackPool();
    console.log(`  ✓ ${this.feedbackPool.length} feedback rows available`);

    const results: {
      label: string;
      sessions: number;
      feedback: number;
      analyzed: number;
      recent: number;
    }[] = [];

    for (const config of DashboardSeeder.CLASS_CONFIGS) {
      results.push(await this.seedClass(config, courseId, topics, ilosByTopic, studentIds));
    }

    const totalFeedback = results.reduce((s, r) => s + r.feedback, 0);
    const totalAnalyzed = results.reduce((s, r) => s + r.analyzed, 0);
    const totalRecent = results.reduce((s, r) => s + r.recent, 0);
    const totalSessionsSeeded = results.reduce((s, r) => s + r.sessions, 0);

    console.log("\n" + "=".repeat(50));
    console.log("Seed Complete");
    console.log("=".repeat(50));
    console.log(`  Classes:       ${DashboardSeeder.CLASS_CONFIGS.length}`);
    console.log(`  Students:      ${DashboardSeeder.STUDENT_COUNT}`);
    console.log(`  Sessions:      ${totalSessionsSeeded}`);
    console.log(`  Feedback:      ${totalFeedback}`);
    console.log(`  Analyzed:      ${totalAnalyzed} feedback rows`);
    console.log(`  Recent:        ${totalRecent} (badge test, excluded from analysis)`);
    console.log("");

    for (const r of results) {
      console.log(
        `  ${r.label}: ${r.sessions} sessions, ${r.feedback} feedback, ${r.analyzed} analyzed, ${r.recent} recent`,
      );
    }

    console.log("");
    console.log("Row counts for verification:");
    console.log(`  analysis_results:     ${totalAnalyzed} rows (1 per analyzed feedback)`);
    console.log(
      `  feedback_diagnostics: ${totalSessionsSeeded} rows (1 per analyzed session)`,
    );
    console.log("");

    console.log("Login at /login/faculty with:");
    console.log("  Email:    faculty@test.com");
    console.log("  Password: faculty123");
    console.log("");

    console.log("Badge test:");
    console.log("  TEST-CLASS1 Session 2: 10 new feedback (created after last_analyzed_at)");
    console.log("");

    await closeAdminSqlClient();
  }

  private async seedClass(
    config: ClassSeedConfig,
    courseId: string,
    topics: { id: string; title: string }[],
    ilosByTopic: TopicIloMap,
    studentIds: string[],
  ) {
    const prefix = `[${config.label}]`;
    console.log(`\n━━━ ${config.label} ━━━`);

    console.log(`${prefix} Class and enrollments...`);
    const classId = await this.getOrCreateClass(config, courseId);
    await this.enrollStudents(classId, studentIds);

    console.log(`${prefix} Sessions...`);
    const sessions = await this.createSessions(config, classId, courseId, topics, ilosByTopic);

    console.log(`${prefix} Feedback...`);
    const { feedbackBySession, recentCount } = await this.createFeedback(
      config,
      sessions,
      studentIds,
    );

    console.log(`${prefix} Analysis...`);
    const analyzedCount = await this.createAnalysisResults(sessions, feedbackBySession, ilosByTopic);

    const feedbackCount =
      Array.from(feedbackBySession.values()).reduce((s, f) => s + f.length, 0) + recentCount;

    return {
      label: config.label,
      sessions: sessions.length,
      feedback: feedbackCount,
      analyzed: analyzedCount,
      recent: recentCount,
    };
  }

  // Phase 1: Prerequisites

  private async getFacultyId(): Promise<string> {
    const { data } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("email", DashboardSeeder.FACULTY_EMAIL)
      .maybeSingle();
    if (data) return data.id;

    const id = DashboardSeeder.seedId("faculty", DashboardSeeder.FACULTY_EMAIL);
    const { data: created, error: insertErr } = await this.supabase
      .from("profiles")
      .insert({
        id,
        email: DashboardSeeder.FACULTY_EMAIL,
        full_name: "Test Faculty",
        role: "faculty",
      })
      .select("id")
      .single();
    if (insertErr || !created)
      throw new Error(`Failed to create faculty profile: ${insertErr?.message ?? "unknown"}`);
    return created.id;
  }

  private async getOrCreateCourse(): Promise<string> {
    const id = DashboardSeeder.seedId("course", DashboardSeeder.COURSE_CODE);

    // Check by deterministic ID first (handles re-runs), then by code (handles pre-existing)
    const { data: byId } = await this.supabase
      .from("courses")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (byId) {
      await this.supabase
        .from("courses")
        .update({ code: DashboardSeeder.COURSE_CODE, title: DashboardSeeder.COURSE_TITLE })
        .eq("id", id);
      return byId.id;
    }

    const { data: byCode } = await this.supabase
      .from("courses")
      .select("id")
      .eq("code", DashboardSeeder.COURSE_CODE)
      .maybeSingle();
    if (byCode) return byCode.id;

    const { data: created, error: insertErr } = await this.supabase
      .from("courses")
      .insert({ id, code: DashboardSeeder.COURSE_CODE, title: DashboardSeeder.COURSE_TITLE })
      .select("id")
      .single();
    if (insertErr || !created)
      throw new Error(`Failed to create course: ${insertErr?.message || "unknown"}`);
    return created.id;
  }

  private async getOrCreateTopics(courseId: string): Promise<{ id: string; title: string }[]> {
    const results: { id: string; title: string }[] = [];
    for (const title of DashboardSeeder.TOPIC_TITLES) {
      const { data: existing } = await this.supabase
        .from("topics")
        .select("id, title")
        .eq("course_id", courseId)
        .eq("title", title)
        .maybeSingle();

      if (existing) {
        results.push(existing);
      } else {
        const id = DashboardSeeder.seedId("topic", courseId, title);
        const { data: created } = await this.supabase
          .from("topics")
          .insert({ id, course_id: courseId, title })
          .select("id, title")
          .single();
        if (created) results.push(created);
      }
    }
    return results;
  }

  private async getOrCreateIlos(
    courseId: string,
    topics: { id: string; title: string }[],
  ): Promise<{ id: string; statement: string; bloomLevel: string; topicId: string }[]> {
    const topicMap = new Map(topics.map((t) => [t.title, t.id]));
    const results: { id: string; statement: string; bloomLevel: string; topicId: string }[] = [];

    for (const def of DashboardSeeder.ILO_DEFS) {
      const topicId = topicMap.get(def.topicTitle);
      if (!topicId) continue;

      const { data: existing } = await this.supabase
        .from("ilos")
        .select("id, statement, bloom_level")
        .eq("course_id", courseId)
        .eq("topic_id", topicId)
        .eq("statement", def.statement)
        .maybeSingle();

      if (existing) {
        results.push({
          id: existing.id,
          statement: existing.statement,
          bloomLevel: existing.bloom_level,
          topicId,
        });
      } else {
        const id = DashboardSeeder.seedId("ilo", courseId, def.statement);
        const { data: created } = await this.supabase
          .from("ilos")
          .insert({
            id,
            course_id: courseId,
            topic_id: topicId,
            statement: def.statement,
            bloom_level: def.bloomLevel,
          })
          .select("id, statement, bloom_level")
          .single();
        if (created)
          results.push({
            id: created.id,
            statement: created.statement,
            bloomLevel: created.bloom_level,
            topicId,
          });
      }
    }
    return results;
  }

  // Phase 2: Students

  private async createStudents(): Promise<string[]> {
    const ids: string[] = [];

    for (let i = 1; i <= DashboardSeeder.STUDENT_COUNT; i++) {
      const email = `test.student${i}@test.com`;
      const { data: existing } = await this.supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        ids.push(existing.id);
      } else {
        const id = DashboardSeeder.seedId("student", email);
        await this.supabase
          .from("profiles")
          .insert({ id, email, full_name: `Test Student ${i}`, role: "student" });
        ids.push(id);
      }
    }

    console.log(`  ✓ ${ids.length} student profiles ready`);
    return ids;
  }

  // Phase 3: Class and Enrollments

  private async getOrCreateClass(config: ClassSeedConfig, courseId: string): Promise<string> {
    const id = DashboardSeeder.seedId("class", config.courseCode, config.section);
    const { data: existing } = await this.supabase
      .from("classes")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    const classRow = {
      faculty_id: this.facultyId,
      course_id: courseId,
      course: config.courseCode,
      section: config.section,
      name: config.label,
      enroll_code: `${config.courseCode}`,
    };

    if (existing) {
      await this.supabase.from("classes").update(classRow).eq("id", existing.id);
      return existing.id;
    }

    const { data: created, error: insertErr } = await this.supabase
      .from("classes")
      .insert({ id, ...classRow })
      .select("id")
      .single();

    if (insertErr || !created)
      throw new Error(`Failed to create class: ${insertErr?.message || "unknown"}`);
    return created.id;
  }

  private async enrollStudents(classId: string, studentIds: string[]): Promise<void> {
    try {
      await this.cleanupEnrollments(classId);

      const rows = studentIds.map((studentId) => ({ class_id: classId, student_id: studentId }));
      const { error } = await this.supabase.from("enrollments").insert(rows);
      if (error) throw new Error(`Enrollment error: ${error.message}`);

      await this.supabase
        .from("classes")
        .update({ student_count: studentIds.length })
        .eq("id", classId);

      console.log(`  ✓ ${studentIds.length} students enrolled`);
    } catch (err) {
      console.error("  ✗ Enrollment failed:", err);
      process.exit(1);
    }
  }

  // Cleanup

  /**
   * Hard-deletes every class this seed manages (current + legacy versions) and
   * their child rows, so re-running fully overwrites previous test data.
   */
  private async cleanupAllTestData(): Promise<void> {
    const classCodes = [
      ...DashboardSeeder.CLASS_CONFIGS.map((c) => c.courseCode),
      ...DashboardSeeder.LEGACY_COURSE_CODES,
    ];
    const courseCodes = [DashboardSeeder.COURSE_CODE, ...DashboardSeeder.LEGACY_COURSE_CODES];

    const sessionFilter =
      "session_id IN (SELECT id FROM sessions WHERE class_id IN (SELECT id FROM classes WHERE course = ANY($1::text[])))";
    const classFilter =
      "class_id IN (SELECT id FROM classes WHERE course = ANY($1::text[]))";

    // Orphaned student profiles from previous seed versions (e.g. test.student51..60).
    // Scoped to this seed's own namespace only — never touches test-nonowner-*,
    // student@test.com, or other profiles the integration tests rely on.
    const orphanStudentFilter =
      "email LIKE 'test.student%@test.com' AND email NOT IN (SELECT 'test.student' || i || '@test.com' FROM generate_series(1, $1::int) AS i)";

    const counts = await adminExec([
      { text: `DELETE FROM feedback_diagnostics WHERE ${sessionFilter}`, params: [classCodes] },
      { text: `DELETE FROM analysis_results WHERE ${sessionFilter}`, params: [classCodes] },
      { text: `DELETE FROM feedback WHERE ${sessionFilter}`, params: [classCodes] },
      { text: `DELETE FROM submission_tokens WHERE ${sessionFilter}`, params: [classCodes] },
      { text: `DELETE FROM sessions WHERE ${classFilter}`, params: [classCodes] },
      { text: `DELETE FROM enrollments WHERE ${classFilter}`, params: [classCodes] },
      { text: `DELETE FROM classes WHERE course = ANY($1::text[])`, params: [classCodes] },
      { text: `DELETE FROM courses WHERE code = ANY($1::text[])`, params: [courseCodes] },
      // FK safety net: activity_log rows referencing purged students must go first
      {
        text: `DELETE FROM activity_log WHERE user_id IN (SELECT id FROM profiles WHERE ${orphanStudentFilter})`,
        params: [DashboardSeeder.STUDENT_COUNT],
      },
      { text: `DELETE FROM profiles WHERE ${orphanStudentFilter}`, params: [DashboardSeeder.STUDENT_COUNT] },
    ]);

    const tableNames = [
      "feedback_diagnostics",
      "analysis_results",
      "feedback",
      "submission_tokens",
      "sessions",
      "enrollments",
      "classes",
      "courses",
      "activity_log",
      "profiles",
    ];
    const deleted = counts
      .map((n, i) => `${tableNames[i]}: ${n}`)
      .filter((_, i) => counts[i] > 0)
      .join(", ");
    console.log(`  ✓ Deleted: ${deleted || "nothing"}`);
  }

  private async cleanupSessionData(sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await adminExec([
      {
        text: "DELETE FROM feedback_diagnostics WHERE session_id = ANY($1::uuid[])",
        params: [sessionIds],
      },
      {
        text: "DELETE FROM analysis_results WHERE session_id = ANY($1::uuid[])",
        params: [sessionIds],
      },
      { text: "DELETE FROM feedback WHERE session_id = ANY($1::uuid[])", params: [sessionIds] },
      { text: "DELETE FROM sessions WHERE id = ANY($1::uuid[])", params: [sessionIds] },
    ]);
  }

  private async cleanupEnrollments(classId: string): Promise<void> {
    await adminExec([{ text: "DELETE FROM enrollments WHERE class_id = $1", params: [classId] }]);
  }

  // Phase 4: Sessions

  private async createSessions(
    config: ClassSeedConfig,
    classId: string,
    courseId: string,
    topics: { id: string; title: string }[],
    ilosByTopic: TopicIloMap,
  ): Promise<SessionSeed[]> {
    const { data: existing } = await this.supabase
      .from("sessions")
      .select("id")
      .eq("class_id", classId);
    const existingIds = existing?.map((s) => s.id) ?? [];
    await this.cleanupSessionData(existingIds);

    const topicMap = new Map(topics.map((t) => [t.title, t.id]));
    const sessionSeeds: SessionSeed[] = [];
    const baseDate = new Date("2026-01-05T00:00:00Z");

    for (let i = 0; i < config.sessionTopics.length; i++) {
      const sessionTopic = config.sessionTopics[i];
      const topicId = topicMap.get(sessionTopic) ?? null;
      const sessionIlos = ilosByTopic.get(sessionTopic) ?? [];

      const startsAt = new Date(baseDate);
      startsAt.setDate(startsAt.getDate() + i * 14);
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + 7);

      let lastAnalyzedAt: string;
      if (i === 0) {
        lastAnalyzedAt = new Date(
          DashboardSeeder.SEED_REFERENCE_DATE.getTime() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
      } else {
        const analyzed = new Date(endsAt);
        analyzed.setDate(analyzed.getDate() + 1);
        lastAnalyzedAt = analyzed.toISOString();
      }

      const sessionId = DashboardSeeder.seedId("session", classId, String(i));

      await this.supabase.from("sessions").insert({
        id: sessionId,
        class_id: classId,
        course_id: courseId,
        topic: sessionTopic,
        topic_id: topicId,
        ilo_ids: sessionIlos.map((ilo) => ilo.id),
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        created_by: this.facultyId,
        last_analyzed_at: lastAnalyzedAt,
      });

      sessionSeeds.push({
        id: sessionId,
        topic: sessionTopic,
        topicId,
        iloIds: sessionIlos.map((ilo) => ilo.id),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: "active",
        lastAnalyzedAt,
      });
    }

    console.log(`  ✓ ${sessionSeeds.length} sessions created`);
    return sessionSeeds;
  }

  // Phase 5: Feedback

  private async loadFeedbackPool(): Promise<void> {
    const csvPath = new URL("../../public/model-data/test.csv", import.meta.url);
    const raw = readFileSync(csvPath, "utf8");
    const parsed = Papa.parse<CsvFeedbackRow>(raw, { header: true, skipEmptyLines: true });
    this.feedbackPool = parsed.data.filter((r) => r.text && r.issue && r.polarity);
  }

  /** Random, non-repeating sample from the CSV pool — the only random part of the seed. */
  private sampleFeedback(count: number): CsvFeedbackRow[] {
    const pool = [...this.feedbackPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  private async createFeedback(
    config: ClassSeedConfig,
    sessions: SessionSeed[],
    studentIds: string[],
  ): Promise<{ feedbackBySession: Map<string, FeedbackSeed[]>; recentCount: number }> {
    const feedbackBySession = new Map<string, FeedbackSeed[]>();
    let nextStudentIdx = 0;
    let recentCount = 0;

    for (let si = 0; si < sessions.length; si++) {
      const session = sessions[si];
      const count = config.feedbackCounts[si];
      const recentForSession = si === 1 ? config.recentCount : 0;
      const sampled = this.sampleFeedback(count + recentForSession);
      const feedbacks: FeedbackSeed[] = [];

      for (let fi = 0; fi < count; fi++) {
        const row = sampled[fi];
        const studentId = studentIds[nextStudentIdx % studentIds.length];
        nextStudentIdx++;
        const issue = row.issue === "uncategorized" ? "Uncategorized" : row.issue;
        const polarity = row.polarity as "pos" | "neu" | "neg";
        const createdAt = new Date(
          new Date(session.startsAt).getTime() + fi * 3600000,
        ).toISOString();
        const feedbackId = DashboardSeeder.seedId("feedback", session.id, String(fi));

        await this.supabase.from("feedback").insert({
          id: feedbackId,
          session_id: session.id,
          content: row.text,
          student_id: studentId,
          meta: {
            cleanedText: row.cleaned_text,
            submittedBy: studentId,
            aspects: [{ aspect: TTI_RULES[issue] ?? "Uncategorized", issue, polarity }],
          },
          created_at: createdAt,
        });

        feedbacks.push({
          id: feedbackId,
          sessionId: session.id,
          studentId,
          content: row.text,
          issue,
          polarity,
          createdAt,
        });
      }

      feedbackBySession.set(session.id, feedbacks);

      // Recent feedback lands after last_analyzed_at so it shows as "new" in the
      // badge test; it is inserted but intentionally excluded from analysis.
      for (let ri = 0; ri < recentForSession; ri++) {
        const row = sampled[count + ri];
        const studentId = studentIds[nextStudentIdx % studentIds.length];
        nextStudentIdx++;
        const issue = row.issue === "uncategorized" ? "Uncategorized" : row.issue;
        const polarity = row.polarity as "pos" | "neu" | "neg";
        const createdAt = new Date(
          DashboardSeeder.SEED_REFERENCE_DATE.getTime() - ri * 3600000,
        ).toISOString();
        const feedbackId = DashboardSeeder.seedId("feedback", session.id, "recent", String(ri));

        await this.supabase.from("feedback").insert({
          id: feedbackId,
          session_id: session.id,
          content: row.text,
          student_id: studentId,
          meta: {
            cleanedText: row.cleaned_text,
            submittedBy: studentId,
            aspects: [{ aspect: TTI_RULES[issue] ?? "Uncategorized", issue, polarity }],
          },
          created_at: createdAt,
        });

        recentCount++;
      }
    }

    const total =
      Array.from(feedbackBySession.values()).reduce((s, f) => s + f.length, 0) + recentCount;
    console.log(`  ✓ ${total} feedback entries created (${recentCount} recent)`);
    return { feedbackBySession, recentCount };
  }

  // Phase 6: Analysis Results and Diagnostics

  private async createAnalysisResults(
    sessions: SessionSeed[],
    feedbackBySession: Map<string, FeedbackSeed[]>,
    ilosByTopic: TopicIloMap,
  ): Promise<number> {
    let analyzedRows = 0;

    for (const session of sessions) {
      const feedbacks = feedbackBySession.get(session.id);
      if (!feedbacks || feedbacks.length === 0) continue;

      const sessionIlos = ilosByTopic.get(session.topic) ?? [];
      const targetRbt = Math.max(
        1,
        ...sessionIlos.map(
          (ilo) =>
            DashboardSeeder.BLOOM_LEVELS[
              ilo.bloomLevel as keyof typeof DashboardSeeder.BLOOM_LEVELS
            ] ?? 1,
        ),
      );

      // Build DiagnosticRecord[] (Modules 2-4 equivalent)
      const buffer: DiagnosticRecord[] = feedbacks.map((fb) => {
        if (fb.issue === "Uncategorized") {
          return {
            tti: TTI_RULES["uncategorized"],
            rbt: RBT_RULES["uncategorized"],
            clt: CLT_RULES["uncategorized"],
            issue: "Uncategorized" as const,
            polarity: fb.polarity,
            isGap: false,
            feedbackId: fb.id,
          };
        }
        return {
          tti: TTI_RULES[fb.issue],
          rbt: RBT_RULES[fb.issue],
          clt: CLT_RULES[fb.issue],
          issue: fb.issue,
          polarity: fb.polarity,
          isGap: RBT_RULES[fb.issue] <= targetRbt && CLT_RULES[fb.issue] === "Intrinsic",
          feedbackId: fb.id,
        };
      });

      const total = feedbacks.length;

      // Module 5: Strategy Generation
      const sessionContext: SessionContext = {
        course: DashboardSeeder.COURSE_TITLE,
        topic: session.topic,
        targetIloRbt: targetRbt,
        sessionId: session.id,
        iloStatement: sessionIlos[0]?.statement ?? "Unknown Goal",
      };

      const stats = CalculateDistributions(buffer, total);

      const uniqueIssueMap = new Map<string, BufferedDiagnostic>();
      for (const diag of buffer) {
        const key = diag.issue.toLowerCase();
        const existing = uniqueIssueMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          uniqueIssueMap.set(key, { ...diag, count: 1 });
        }
      }

      const recommendationList: RecommendationItem[] = [];
      const warningList: RecommendationItem[] = [];

      for (const uniqueIssue of uniqueIssueMap.values()) {
        if (uniqueIssue.issue === "Uncategorized") continue;

        const weightedCoefficient = uniqueIssue.isGap ? 1.5 : 1.0;
        const priorityScore = (uniqueIssue.count / total) * weightedCoefficient;

        const pedagogicalCue = GeneratePedagogicalCue(sessionContext, uniqueIssue, total);

        if (priorityScore >= DashboardSeeder.PRIORITY_THRESHOLD) {
          recommendationList.push(pedagogicalCue);
        } else {
          warningList.push(pedagogicalCue);
        }
      }

      // Module 6: Dashboard Output
      const aspectDist: DistEntry[] = Object.entries(stats.aspectCounts)
        .map(([label, value]) => ({ label, value }) as DistEntry)
        .sort((a, b) => b.value - a.value);

      const issueDist: DistEntry[] = Object.entries(stats.issueCounts)
        .map(([key, value]) => ({ label: ISSUE_RULES[key.toLowerCase()] ?? key, value }) as DistEntry)
        .sort((a, b) => b.value - a.value);

      const polarityDist: DistEntry[] = [
        { label: "Positive", value: stats.polarityCounts.pos || 0 },
        { label: "Neutral", value: stats.polarityCounts.neu || 0 },
        { label: "Negative", value: stats.polarityCounts.neg || 0 },
      ];

      const rbtDist: DistEntry[] = Object.entries(stats.rbtCounts)
        .map(([label, value]) => ({ label, value }) as DistEntry)
        .sort(
          (a, b) =>
            (RBT_LEVELS as readonly string[]).indexOf(a.label) -
            (RBT_LEVELS as readonly string[]).indexOf(b.label),
        );

      const cltDist: DistEntry[] = Object.entries(stats.cltCounts)
        .map(([label, value]) => ({ label, value }) as DistEntry)
        .sort((a, b) => b.value - a.value);

      // Enrich distribution entries with contributing feedback texts
      const feedbackMap = new Map<string, string>();
      for (const fb of feedbacks) feedbackMap.set(fb.id, fb.content);

      const aspectToTexts = new Map<string, string[]>();
      const issueToTexts = new Map<string, string[]>();
      const polarityToTexts: Record<string, string[]> = { pos: [], neu: [], neg: [] };
      const rbtToTexts = new Map<string, string[]>();
      const cltToTexts = new Map<string, string[]>();

      for (const diag of buffer) {
        const text = feedbackMap.get(diag.feedbackId ?? "");
        if (!text) continue;

        const aspectList = aspectToTexts.get(diag.tti) ?? [];
        aspectList.push(text);
        aspectToTexts.set(diag.tti, aspectList);

        const issueLabel = ISSUE_RULES[diag.issue.toLowerCase()] ?? diag.issue;
        const issueList = issueToTexts.get(issueLabel) ?? [];
        issueList.push(text);
        issueToTexts.set(issueLabel, issueList);

        if (diag.polarity in polarityToTexts) {
          polarityToTexts[diag.polarity].push(text);
        }

        const rbtName =
          diag.issue === "Uncategorized"
            ? "Uncategorized"
            : (RBT_LEVELS[diag.rbt] ?? String(diag.rbt));
        const rbtList = rbtToTexts.get(rbtName) ?? [];
        rbtList.push(text);
        rbtToTexts.set(rbtName, rbtList);

        const cltLabel = diag.issue === "Uncategorized" ? "Uncategorized" : diag.clt;
        const cltList = cltToTexts.get(cltLabel) ?? [];
        cltList.push(text);
        cltToTexts.set(cltLabel, cltList);
      }

      for (const entry of aspectDist) entry.feedbackTexts = aspectToTexts.get(entry.label);
      for (const entry of issueDist) entry.feedbackTexts = issueToTexts.get(entry.label);
      const polarityLabelKey: Record<string, string> = {
        Positive: "pos",
        Neutral: "neu",
        Negative: "neg",
      };
      for (const entry of polarityDist)
        entry.feedbackTexts = polarityToTexts[polarityLabelKey[entry.label]];
      for (const entry of rbtDist) entry.feedbackTexts = rbtToTexts.get(entry.label);
      for (const entry of cltDist) entry.feedbackTexts = cltToTexts.get(entry.label);

      // Gap items
      const gaps: GapItem[] = [];
      for (const gapDiag of buffer.filter((d) => d.isGap)) {
        const ilo = sessionIlos[0];
        if (ilo) {
          gaps.push({
            iloId: ilo.id,
            expected: ilo.statement,
            actual: `Issue: "${gapDiag.issue}" (CLT: ${gapDiag.clt}, RBT: Level ${gapDiag.rbt})`,
            severity: "medium" as const,
          });
        }
      }

      const analysisResult: AnalysisResult = {
        sessionId: session.id,
        totalFeedback: total,
        aspectDist,
        issueDist,
        polarityDist,
        rbtDist,
        cltDist,
        gaps,
        recommendations: recommendationList.map((r) => ({
          id: DashboardSeeder.seedId("recommendation", session.id, r.issue),
          paragraph: r.paragraph,
          terms: r.terms as RecommendationTerm[],
          theories: r.theories as Theory[],
          priority: r.priority,
        })),
        warnings: warningList.map((recommendationItem) => ({
          id: DashboardSeeder.seedId("warning", session.id, recommendationItem.issue),
          issue: recommendationItem.issue,
          terms: recommendationItem.terms as RecommendationTerm[],
          theories: recommendationItem.theories as Theory[],
          priority: recommendationItem.priority,
          count: recommendationItem.priority,
          isGap: recommendationItem.isGap,
        })),
      };

      await this.supabase.from("analysis_results").insert(
        feedbacks.map((fb) => ({
          session_id: session.id,
          feedback_id: fb.id,
          issue: fb.issue,
          polarity: fb.polarity,
        })),
      );

      await this.supabase.from("feedback_diagnostics").insert({
        session_id: session.id,
        result: analysisResult,
        rules_version: RULES_VERSION,
      });

      analyzedRows += feedbacks.length;
      console.log(
        `  ✓ Analysis result (${feedbacks.length} raw rows, 1 cache row) for "${session.topic}"`,
      );
    }

    return analyzedRows;
  }
}

new DashboardSeeder().run().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});