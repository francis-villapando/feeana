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
  formatDashboardOutput,
  buildIloGapItems,
  getIloLevel,
} from "../../src/lib/algorithm/dashboardOutput";
import { buildDiagnosticRecord } from "../../src/lib/algorithm/pedagogicalDiagnosticMapping";
import { TTI_RULES, ISSUE_RULES, RBT_LEVELS, RULES_VERSION } from "../../src/lib/algorithm/rules";
import type {
  SessionContext,
  DiagnosticRecord,
  BufferedDiagnostic,
  RecommendationItem,
} from "../../src/lib/algorithm/types";
import type {
  DistEntry,
  AnalysisResult,
  RecommendationTerm,
  Theory,
} from "../../src/lib/types/types";

// Dual-faculty + dev seed. Seeds:
//   - CSEG2 / CS102 demo curricula (always analyzed).
//   - TEST-COURSE-CODE dev sandbox under dev@feeana.me, isolated from non-dev
//     faculty via filterCurriculumForUser; analysis gated by --analyzed.
//   - Collaborative activity logs spanning the last 14 days.
//
// Usage:
//   npx tsx --env-file .env scripts/seed/seed.ts              (dev collection-only)
//   npx tsx --env-file .env scripts/seed/seed.ts --analyzed   (dev analyzed)
//
// Entity IDs and timestamps are deterministic; only the sampled feedback subset
// from public/model-data/test.csv varies between runs.

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
  lastAnalyzedAt?: string | null;
}

interface AccountDef {
  email: string;
  password: string;
  fullName: string;
  role: "faculty" | "student";
}

interface IloDef {
  statement: string;
  bloomLevel: string;
}

interface TopicDef {
  title: string;
  ilos: IloDef[];
}

interface CourseDef {
  code: string;
  title: string;
  ownerEmail: string;
  topics: TopicDef[];
}

interface SessionDef {
  topicTitle: string;
  feedbackCount: number;
  analyzedCount: number;
  biasIssue?: string;
  biasCount?: number;
}

interface ClassDef {
  courseCode: string;
  section: string;
  enrollCode: string;
  studentCount: number;
  ownerEmail: string;
  sessions: SessionDef[];
  /** Overrides courseCode when deriving the deterministic class id (legacy dev classes). */
  classIdKey?: string;
}

interface ActivityLogDef {
  entity: "course" | "topic" | "ILO";
  entityKey: string;
  action: "created" | "updated";
  label: string;
  newLabel?: string;
  userEmail: string;
  daysAgo: number;
}

interface ClassSeedResult {
  label: string;
  group: "faculty" | "dev";
  sessions: number;
  feedback: number;
  analyzed: number;
  pending: number;
  diagnostics: number;
}

type TopicIloMap = Map<string, { id: string; statement: string; bloomLevel: string }[]>;

class DashboardSeeder {
  // Account definitions
  // The dev email used by isDevEmail() to isolate dev-authored curriculum from non-dev faculty.
  private static readonly DEV_EMAIL = process.env.VITE_DEV_EMAIL ?? "dev@feeana.me";

  // Dev login account, keyed to DEV_EMAIL so the dev user sees the isolated sandbox.
  private static readonly DEV_ACCOUNT: AccountDef = {
    email: DashboardSeeder.DEV_EMAIL,
    password: "iamDev-feeana.ai1",
    fullName: "Dev",
    role: "faculty",
  };

  // Legacy test faculty account required by integration tests (signs in as faculty@test.com).
  private static readonly TEST_ACCOUNT: AccountDef = {
    email: "faculty@test.com",
    password: "faculty123",
    fullName: "Test Faculty",
    role: "faculty",
  };

  private static readonly FACULTY_ACCOUNTS: AccountDef[] = [
    {
      email: "maria.santos@feeana.me",
      password: "Santos123",
      fullName: "Maria Santos",
      role: "faculty",
    },
    {
      email: "juan.delacruz@feeana.me",
      password: "Delacruz123",
      fullName: "Juan Dela Cruz",
      role: "faculty",
    },
  ];

  // Curriculum definitions
  private static readonly COURSES: CourseDef[] = [
    {
      code: "CSEG2",
      title: "Game Programming 1",
      ownerEmail: "maria.santos@feeana.me",
      topics: [
        {
          title: "Introduction to 2D Physics and Collision Detection",
          ilos: [
            {
              statement: "Explain the mathematical principles behind AABB collision detection",
              bloomLevel: "Understand",
            },
            {
              statement: "Implement dynamic rigid body physics within a 2D game loop",
              bloomLevel: "Apply",
            },
            {
              statement: "Analyze frame-rate performance bottlenecks in physics calculations",
              bloomLevel: "Analyze",
            },
          ],
        },
        {
          title: "Game State Management & Design Patterns",
          ilos: [
            {
              statement: "Identify common architectural patterns in game design",
              bloomLevel: "Remember",
            },
            {
              statement: "Construct a state machine for character movement and transitions",
              bloomLevel: "Create",
            },
          ],
        },
        {
          title: "Sprite Animation and Particle Effects",
          ilos: [
            {
              statement:
                "Differentiate frame-based sprite animation and procedural sprite transformations",
              bloomLevel: "Understand",
            },
            {
              statement:
                "Implement a custom particle emitter system for interactive gameplay feedback",
              bloomLevel: "Apply",
            },
            {
              statement:
                "Optimize sprite rendering performance using texture atlases and sprite batching",
              bloomLevel: "Analyze",
            },
          ],
        },
      ],
    },
    {
      code: "CS102",
      title: "Web Systems and Technologies",
      ownerEmail: "juan.delacruz@feeana.me",
      topics: [
        {
          title: "RESTful API Design & Authentication",
          ilos: [
            {
              statement: "Differentiate session-based and token-based authentication mechanisms",
              bloomLevel: "Understand",
            },
            {
              statement: "Implement secure JWT authorization middleware in backend services",
              bloomLevel: "Apply",
            },
          ],
        },
        {
          title: "Database Optimization & Indexing",
          ilos: [
            {
              statement: "Evaluate query execution plans for indexing optimization",
              bloomLevel: "Evaluate",
            },
          ],
        },
      ],
    },
    // Dev sandbox course: owned by the dev email so filterCurriculumForUser hides it
    // from non-dev faculty. Analysis of its sessions is gated by --analyzed.
    {
      code: "TEST-COURSE-CODE",
      title: "TEST Course Title",
      ownerEmail: DashboardSeeder.DEV_EMAIL,
      topics: [
        {
          title: "TEST Topic 1",
          ilos: [
            { statement: "TEST ILO 1", bloomLevel: "Remember" },
            { statement: "TEST ILO 2", bloomLevel: "Understand" },
            { statement: "TEST ILO 3", bloomLevel: "Apply" },
          ],
        },
        {
          title: "TEST Topic 2",
          ilos: [
            { statement: "TEST ILO 4", bloomLevel: "Analyze" },
            { statement: "TEST ILO 5", bloomLevel: "Evaluate" },
            { statement: "TEST ILO 6", bloomLevel: "Create" },
          ],
        },
        {
          title: "TEST Topic 3",
          ilos: [
            { statement: "TEST ILO 7", bloomLevel: "Understand" },
            { statement: "TEST ILO 8", bloomLevel: "Apply" },
            { statement: "TEST ILO 9", bloomLevel: "Analyze" },
          ],
        },
      ],
    },
  ];

  // Class & session definitions
  private static readonly CLASSES: ClassDef[] = [
    {
      courseCode: "CSEG2",
      section: "4CS-C",
      enrollCode: "RBO889H1",
      studentCount: 50,
      ownerEmail: "maria.santos@feeana.me",
      sessions: [
        {
          topicTitle: "Introduction to 2D Physics and Collision Detection",
          feedbackCount: 46,
          analyzedCount: 46,
          biasIssue: "conceptual misalignment",
          biasCount: 18,
        },
        {
          topicTitle: "Game State Management & Design Patterns",
          feedbackCount: 49,
          analyzedCount: 49,
        },
        {
          topicTitle: "Sprite Animation and Particle Effects",
          feedbackCount: 22,
          analyzedCount: 10,
        },
      ],
    },
    {
      courseCode: "CSEG2",
      section: "4CS-B",
      enrollCode: "GU4UUP7Q",
      studentCount: 40,
      ownerEmail: "maria.santos@feeana.me",
      sessions: [
        {
          topicTitle: "Introduction to 2D Physics and Collision Detection",
          feedbackCount: 34,
          analyzedCount: 34,
        },
      ],
    },
    {
      courseCode: "CS102",
      section: "4CS-C",
      enrollCode: "KENYFK1B",
      studentCount: 45,
      ownerEmail: "juan.delacruz@feeana.me",
      sessions: [
        {
          topicTitle: "RESTful API Design & Authentication",
          feedbackCount: 42,
          analyzedCount: 42,
        },
        {
          topicTitle: "Database Optimization & Indexing",
          feedbackCount: 0,
          analyzedCount: 0,
        },
      ],
    },
  ];

  // Dev sandbox classes
  // analyzedCount holds the "when --analyzed" value; run() zeroes it for collection-only
  // mode. classIdKey preserves the legacy deterministic ids (seedId("class","TESTCLS1","1"))
  // so cleanup stays idempotent against previously seeded dev data.
  private static readonly DEV_CLASSES: ClassDef[] = [
    {
      courseCode: "TEST-COURSE-CODE",
      section: "1",
      enrollCode: "TESTCLS1",
      studentCount: 50,
      ownerEmail: DashboardSeeder.DEV_EMAIL,
      classIdKey: "TESTCLS1",
      sessions: [
        {
          topicTitle: "TEST Topic 1",
          feedbackCount: 50,
          analyzedCount: 50,
          biasIssue: "conceptual misalignment",
          biasCount: 18,
        },
        {
          topicTitle: "TEST Topic 2",
          feedbackCount: 40,
          analyzedCount: 30,
        },
        {
          topicTitle: "TEST Topic 3",
          feedbackCount: 30,
          analyzedCount: 30,
        },
      ],
    },
    {
      courseCode: "TEST-COURSE-CODE",
      section: "2",
      enrollCode: "TESTCLS2",
      studentCount: 50,
      ownerEmail: DashboardSeeder.DEV_EMAIL,
      classIdKey: "TESTCLS2",
      sessions: [
        {
          topicTitle: "TEST Topic 1",
          feedbackCount: 35,
          analyzedCount: 35,
        },
      ],
    },
  ];

  // Collaborative activity log definitions (spanning last 14 days)
  private static readonly ACTIVITY_LOGS: ActivityLogDef[] = [
    {
      entity: "course",
      entityKey: "CSEG2",
      action: "created",
      label: "CSEG2 — Game Programming 1",
      userEmail: "maria.santos@feeana.me",
      daysAgo: 14,
    },
    {
      entity: "topic",
      entityKey: "CSEG2:Introduction to 2D Physics and Collision Detection",
      action: "created",
      label: "Introduction to 2D Physics and Collision Detection",
      userEmail: "maria.santos@feeana.me",
      daysAgo: 12,
    },
    {
      entity: "ILO",
      entityKey: "CSEG2:Implement dynamic rigid body physics within a 2D game loop",
      action: "created",
      label: "Implement dynamic rigid body physics within a 2D game loop",
      userEmail: "maria.santos@feeana.me",
      daysAgo: 12,
    },
    {
      entity: "course",
      entityKey: "CS102",
      action: "created",
      label: "CS102 — Web Systems and Technologies",
      userEmail: "juan.delacruz@feeana.me",
      daysAgo: 10,
    },
    {
      entity: "topic",
      entityKey: "CS102:RESTful API Design & Authentication",
      action: "created",
      label: "RESTful API Design & Authentication",
      userEmail: "juan.delacruz@feeana.me",
      daysAgo: 9,
    },
    {
      entity: "topic",
      entityKey: "CSEG2:Game State Management & Design Patterns",
      action: "created",
      label: "Game State Management & Design Patterns",
      userEmail: "maria.santos@feeana.me",
      daysAgo: 7,
    },
    {
      entity: "topic",
      entityKey: "CSEG2:Sprite Animation and Particle Effects",
      action: "created",
      label: "Sprite Animation and Particle Effects",
      userEmail: "maria.santos@feeana.me",
      daysAgo: 5,
    },
    {
      entity: "topic",
      entityKey: "CS102:RESTful API Design & Authentication",
      action: "updated",
      label: "RESTful API Design & Authentication",
      newLabel: "RESTful API Design & Secure Authentication",
      userEmail: "juan.delacruz@feeana.me",
      daysAgo: 2,
    },
    {
      entity: "ILO",
      entityKey: "CSEG2:Explain the mathematical principles behind AABB collision detection",
      action: "updated",
      label: "Explain the mathematical principles behind AABB collision detection",
      userEmail: "maria.santos@feeana.me",
      daysAgo: 0.75, // 18 hours
    },
  ];

  private static readonly PRIORITY_THRESHOLD = 0.3;

  private supabase: SeedSupabase;
  private feedbackPool: CsvFeedbackRow[] = [];
  private accountIds = new Map<string, string>(); // email -> profile id

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
      console.error("Run with: npx tsx --env-file .env scripts/seed/seed.ts");
      process.exit(1);
    }
    this.supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  private static seedId(namespace: string, ...parts: string[]): string {
    const hash = createHash("sha256")
      .update([namespace, ...parts].join(":"))
      .digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }

  async run(): Promise<void> {
    const analyzed = process.argv.includes("--analyzed");
    const totalClasses = DashboardSeeder.CLASSES.length + DashboardSeeder.DEV_CLASSES.length;

    console.log("Dual-Faculty & Dev Seed Script\n");
    console.log(
      `Target: ${DashboardSeeder.COURSES.length} courses, ${totalClasses} classes, ${DashboardSeeder.FACULTY_ACCOUNTS.length} faculty accounts`,
    );
    console.log(
      `Mode: faculty always analyzed · dev ${analyzed ? "analyzed (--analyzed)" : "collection-only (not analyzed)"}\n`,
    );

    console.log("[1] Accounts...");
    await this.provisionAccounts();
    console.log(`  ✓ ${this.accountIds.size} accounts ready`);

    console.log("[2] Purging previous seed data...");
    await this.cleanupAllSeedData();
    console.log("  ✓ Previous seed data removed");

    console.log("[3] Curriculum (courses, topics, ILOs)...");
    const curriculum = await this.seedCurriculum();
    console.log(
      `  ✓ ${curriculum.courses.size} courses, ${curriculum.topics.size} topics, ${curriculum.ilos.size} ILOs`,
    );

    console.log("[4] Students...");
    const studentIds = await this.createStudents();

    console.log("[5] Loading feedback pool from public/model-data/test.csv...");
    await this.loadFeedbackPool();
    console.log(`  ✓ ${this.feedbackPool.length} feedback rows available`);

    console.log("[6] Classes, sessions, feedback, analysis...");
    const results = await this.seedAllClasses(curriculum, studentIds, analyzed);

    console.log("[7] Activity logs...");
    await this.seedActivityLogs(curriculum);
    console.log("  ✓ 9 collaborative activity log entries");

    const totalFeedback = results.reduce((s, r) => s + r.feedback, 0);
    const totalAnalyzed = results.reduce((s, r) => s + r.analyzed, 0);
    const totalPending = results.reduce((s, r) => s + r.pending, 0);
    const totalSessions = results.reduce((s, r) => s + r.sessions, 0);
    const totalDiagnostics = results.reduce((s, r) => s + r.diagnostics, 0);

    const faculty = results.filter((r) => r.group === "faculty");
    const dev = results.filter((r) => r.group === "dev");
    const sum = (rs: ClassSeedResult[], key: keyof ClassSeedResult) =>
      rs.reduce((s, r) => s + (r[key] as number), 0);

    console.log("\n" + "=".repeat(50));
    console.log("Seed Complete");
    console.log("=".repeat(50));
    console.log(`  Courses:       ${curriculum.courses.size}`);
    console.log(`  Classes:       ${totalClasses}`);
    console.log(`  Sessions:      ${totalSessions}`);
    console.log(`  Feedback:      ${totalFeedback}`);
    console.log(`  Analyzed:      ${totalAnalyzed} feedback rows`);
    console.log(`  Pending:       ${totalPending} (badge test, excluded from analysis)`);
    console.log("");

    for (const r of results) {
      console.log(
        `  ${r.label}: ${r.sessions} sessions, ${r.feedback} feedback, ${r.analyzed} analyzed, ${r.pending} pending`,
      );
    }

    console.log("");
    console.log("Faculty (always analyzed):");
    console.log(
      `  ${sum(faculty, "sessions")} sessions, ${sum(faculty, "feedback")} feedback, ${sum(faculty, "analyzed")} analyzed, ${sum(faculty, "diagnostics")} diagnostics`,
    );
    console.log("Dev sandbox:");
    console.log(
      analyzed
        ? `  ${sum(dev, "sessions")} sessions, ${sum(dev, "feedback")} feedback, ${sum(dev, "analyzed")} analyzed, ${sum(dev, "diagnostics")} diagnostics`
        : `  ${sum(dev, "sessions")} sessions, ${sum(dev, "feedback")} feedback, 0 analyzed (collection-only; run with --analyzed)`,
    );

    console.log("");
    console.log("Row counts for verification:");
    console.log(`  analysis_results:     ${totalAnalyzed} rows (1 per analyzed feedback)`);
    console.log(`  feedback_diagnostics: ${totalDiagnostics} rows (1 per analyzed session)`);
    console.log(`  activity_log:         9 rows (collaborative)`);
    console.log("");
    console.log("Badge test:");
    console.log("  Maria 4CS-C Session 3 (Sprite Animation): 10 analyzed + 12 pending");
    if (analyzed) {
      console.log("  Dev TEST-CLASS1 Session 2 (TEST Topic 2): 30 analyzed + 10 pending");
    }
    console.log("Empty session:");
    console.log("  Juan 4CS-C Session 2 (Database Optimization): 0 feedback");
    console.log("");

    console.log("Seeded accounts:");
    console.log(`  Dev:      ${DashboardSeeder.DEV_ACCOUNT.email}`);
    for (const acc of DashboardSeeder.FACULTY_ACCOUNTS) {
      console.log(`  Faculty:  ${acc.email}`);
    }
    console.log(`  Test:     ${DashboardSeeder.TEST_ACCOUNT.email}`);
    console.log("");

    await closeAdminSqlClient();
  }

  // Phase 1: Accounts

  /**
   * Creates or verifies the auth user + profile for every seed account.
   * Uses the Supabase Admin Auth API so the accounts can log in directly.
   */
  private async provisionAccounts(): Promise<void> {
    const accounts = [
      DashboardSeeder.DEV_ACCOUNT,
      ...DashboardSeeder.FACULTY_ACCOUNTS,
      DashboardSeeder.TEST_ACCOUNT,
    ];

    for (const acc of accounts) {
      const id = await this.ensureAuthUser(acc);
      this.accountIds.set(acc.email, id);
    }
  }

  private async ensureAuthUser(acc: AccountDef): Promise<string> {
    // Reuse the existing profile.
    const { data: existing } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("email", acc.email)
      .maybeSingle();
    if (existing) return existing.id;

    // Create the auth user via admin API (email confirmed so login works immediately).
    const { data: createdUser, error: createErr } = await this.supabase.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { full_name: acc.fullName, role: acc.role },
    });
    if (createErr) {
      // If the auth user already exists but the profile is missing, look it up by email.
      const { data: byEmail } = await this.supabase.auth.admin.listUsers();
      const match = byEmail?.users.find((u) => u.email === acc.email);
      if (match) {
        await this.upsertProfile(match.id, acc);
        return match.id;
      }
      throw new Error(`Failed to create auth user ${acc.email}: ${createErr.message}`);
    }
    if (!createdUser?.user) throw new Error(`Failed to create auth user ${acc.email}`);

    await this.upsertProfile(createdUser.user.id, acc);
    return createdUser.user.id;
  }

  private async upsertProfile(id: string, acc: AccountDef): Promise<void> {
    const { error } = await this.supabase.from("profiles").upsert(
      {
        id,
        email: acc.email,
        full_name: acc.fullName,
        role: acc.role,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(`Failed to upsert profile for ${acc.email}: ${error.message}`);
  }

  // Phase 2: Curriculum

  private async seedCurriculum(): Promise<{
    courses: Map<string, string>; // course code -> id
    topics: Map<string, string>; // topic key (code:title) -> id
    ilos: Map<string, string>; // ilo key (code:statement) -> id
    ilosByTopic: Map<string, { id: string; statement: string; bloomLevel: string }[]>;
  }> {
    const courses = new Map<string, string>();
    const topics = new Map<string, string>();
    const ilos = new Map<string, string>();
    const ilosByTopic = new Map<string, { id: string; statement: string; bloomLevel: string }[]>();

    for (const courseDef of DashboardSeeder.COURSES) {
      const ownerId = this.accountIds.get(courseDef.ownerEmail);
      if (!ownerId) throw new Error(`No account for course owner ${courseDef.ownerEmail}`);

      const courseId = await this.getOrCreateCourse(courseDef, ownerId);
      courses.set(courseDef.code, courseId);

      for (const topicDef of courseDef.topics) {
        const topicId = await this.getOrCreateTopic(courseId, topicDef.title);
        const topicKey = `${courseDef.code}:${topicDef.title}`;
        topics.set(topicKey, topicId);

        const topicIlos: { id: string; statement: string; bloomLevel: string }[] = [];
        for (const iloDef of topicDef.ilos) {
          const iloId = await this.getOrCreateIlo(courseId, topicId, iloDef);
          const iloKey = `${courseDef.code}:${iloDef.statement}`;
          ilos.set(iloKey, iloId);
          topicIlos.push({ id: iloId, statement: iloDef.statement, bloomLevel: iloDef.bloomLevel });
        }
        ilosByTopic.set(topicKey, topicIlos);
      }
    }

    return { courses, topics, ilos, ilosByTopic };
  }

  private async getOrCreateCourse(def: CourseDef, ownerId: string): Promise<string> {
    const id = DashboardSeeder.seedId("course", def.code);
    const { data: byId } = await this.supabase
      .from("courses")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (byId) {
      await this.supabase
        .from("courses")
        .update({ code: def.code, title: def.title, created_by: ownerId })
        .eq("id", id);
      return byId.id;
    }

    const { data: byCode } = await this.supabase
      .from("courses")
      .select("id")
      .eq("code", def.code)
      .maybeSingle();
    if (byCode) return byCode.id;

    const { data: created, error: insertErr } = await this.supabase
      .from("courses")
      .insert({ id, code: def.code, title: def.title, created_by: ownerId })
      .select("id")
      .single();
    if (insertErr || !created)
      throw new Error(`Failed to create course ${def.code}: ${insertErr?.message || "unknown"}`);
    return created.id;
  }

  private async getOrCreateTopic(courseId: string, title: string): Promise<string> {
    const { data: existing } = await this.supabase
      .from("topics")
      .select("id")
      .eq("course_id", courseId)
      .eq("title", title)
      .maybeSingle();
    if (existing) return existing.id;

    const id = DashboardSeeder.seedId("topic", courseId, title);
    const { data: created, error: insertErr } = await this.supabase
      .from("topics")
      .insert({ id, course_id: courseId, title })
      .select("id")
      .single();
    if (insertErr || !created)
      throw new Error(`Failed to create topic ${title}: ${insertErr?.message || "unknown"}`);
    return created.id;
  }

  private async getOrCreateIlo(courseId: string, topicId: string, def: IloDef): Promise<string> {
    const { data: existing } = await this.supabase
      .from("ilos")
      .select("id")
      .eq("course_id", courseId)
      .eq("topic_id", topicId)
      .eq("statement", def.statement)
      .maybeSingle();
    if (existing) return existing.id;

    const id = DashboardSeeder.seedId("ilo", courseId, def.statement);
    const { data: created, error: insertErr } = await this.supabase
      .from("ilos")
      .insert({
        id,
        course_id: courseId,
        topic_id: topicId,
        statement: def.statement,
        bloom_level: def.bloomLevel,
      })
      .select("id")
      .single();
    if (insertErr || !created)
      throw new Error(`Failed to create ILO: ${insertErr?.message || "unknown"}`);
    return created.id;
  }

  // Phase 3: Students

  private async createStudents(): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 1; i <= 50; i++) {
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
        const { error } = await this.supabase.from("profiles").insert({
          id,
          email,
          full_name: `Test Student ${i}`,
          role: "student",
        });
        if (error) throw new Error(`Failed to create student profile: ${error.message}`);
        ids.push(id);
      }
    }
    console.log(`  ✓ ${ids.length} student profiles ready`);
    return ids;
  }

  // Phase 4: Classes, sessions, feedback, analysis

  private async seedAllClasses(
    curriculum: {
      courses: Map<string, string>;
      topics: Map<string, string>;
      ilosByTopic: Map<string, { id: string; statement: string; bloomLevel: string }[]>;
    },
    studentIds: string[],
    analyzed: boolean,
  ): Promise<ClassSeedResult[]> {
    const results: ClassSeedResult[] = [];

    // Faculty classes are always analyzed as defined.
    for (const classDef of DashboardSeeder.CLASSES) {
      results.push(await this.seedClass(classDef, curriculum, studentIds, "faculty"));
    }

    // Dev sandbox: analyzedCount is honored only with --analyzed; otherwise zeroed so
    // sessions are seeded collection-only (last_analyzed_at = null).
    for (const classDef of DashboardSeeder.DEV_CLASSES) {
      const effective: ClassDef = {
        ...classDef,
        sessions: classDef.sessions.map((s) => ({
          ...s,
          analyzedCount: analyzed ? s.analyzedCount : 0,
        })),
      };
      results.push(await this.seedClass(effective, curriculum, studentIds, "dev"));
    }

    return results;
  }

  private async seedClass(
    classDef: ClassDef,
    curriculum: {
      courses: Map<string, string>;
      topics: Map<string, string>;
      ilosByTopic: Map<string, { id: string; statement: string; bloomLevel: string }[]>;
    },
    studentIds: string[],
    group: "faculty" | "dev",
  ): Promise<ClassSeedResult> {
    const ownerId = this.accountIds.get(classDef.ownerEmail);
    if (!ownerId) throw new Error(`No account for class owner ${classDef.ownerEmail}`);
    const courseId = curriculum.courses.get(classDef.courseCode);
    if (!courseId) throw new Error(`No course for ${classDef.courseCode}`);

    const label = `${classDef.courseCode} · ${classDef.section}`;
    const prefix = `[${label}]`;
    console.log(`\n=== ${label} ===`);

    console.log(`${prefix} Class and enrollments...`);
    const classId = await this.getOrCreateClass(classDef, courseId, ownerId);
    await this.enrollStudents(classId, studentIds.slice(0, classDef.studentCount));

    console.log(`${prefix} Sessions...`);
    const sessions = await this.createSessions(classDef, classId, courseId, curriculum);

    console.log(`${prefix} Feedback...`);
    const { feedbackBySession, usedStudents } = await this.createFeedback(
      classDef,
      sessions,
      studentIds,
    );

    let analyzedCount = 0;
    let diagnosticsCount = 0;
    let pendingCount = 0;

    for (let si = 0; si < sessions.length; si++) {
      const session = sessions[si];
      const sessionDef = classDef.sessions[si];
      const feedbacks = feedbackBySession.get(session.id) ?? [];

      if (sessionDef.analyzedCount > 0 && feedbacks.length > 0) {
        const analyzed = await this.analyzeSession(
          session,
          feedbacks,
          curriculum.ilosByTopic,
          classDef.courseCode,
        );
        analyzedCount += analyzed;
        diagnosticsCount += 1;
      }

      // Badge test: insert pending feedback after last_analyzed_at.
      const pendingCountForSession = sessionDef.feedbackCount - sessionDef.analyzedCount;
      if (pendingCountForSession > 0) {
        const pending = await this.insertPendingFeedback(
          session,
          pendingCountForSession,
          usedStudents.get(session.id) ?? new Set(),
          studentIds,
        );
        pendingCount += pending;
      }
    }

    const feedbackCount =
      Array.from(feedbackBySession.values()).reduce((s, f) => s + f.length, 0) + pendingCount;

    return {
      label,
      group,
      sessions: sessions.length,
      feedback: feedbackCount,
      analyzed: analyzedCount,
      pending: pendingCount,
      diagnostics: diagnosticsCount,
    };
  }

  private async getOrCreateClass(
    classDef: ClassDef,
    courseId: string,
    ownerId: string,
  ): Promise<string> {
    const id = DashboardSeeder.seedId(
      "class",
      classDef.classIdKey ?? classDef.courseCode,
      classDef.section,
    );
    const { data: existing } = await this.supabase
      .from("classes")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    const classRow = {
      faculty_id: ownerId,
      course_id: courseId,
      course: classDef.courseCode,
      section: classDef.section,
      name: classDef.courseCode,
      enroll_code: classDef.enrollCode,
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
    await this.cleanupEnrollments(classId);
    const rows = studentIds.map((studentId) => ({ class_id: classId, student_id: studentId }));
    const { error } = await this.supabase.from("enrollments").insert(rows);
    if (error) throw new Error(`Enrollment error: ${error.message}`);

    await this.supabase
      .from("classes")
      .update({ student_count: studentIds.length })
      .eq("id", classId);
    console.log(`  ✓ ${studentIds.length} students enrolled`);
  }

  private async createSessions(
    classDef: ClassDef,
    classId: string,
    courseId: string,
    curriculum: {
      topics: Map<string, string>;
      ilosByTopic: Map<string, { id: string; statement: string; bloomLevel: string }[]>;
    },
  ): Promise<SessionSeed[]> {
    const { data: existing } = await this.supabase
      .from("sessions")
      .select("id")
      .eq("class_id", classId);
    const existingIds = existing?.map((s) => s.id) ?? [];
    await this.cleanupSessionData(existingIds);

    const sessionSeeds: SessionSeed[] = [];
    const baseDate = new Date("2026-01-05T00:00:00Z");

    for (let i = 0; i < classDef.sessions.length; i++) {
      const sessionDef = classDef.sessions[i];
      const topicKey = `${classDef.courseCode}:${sessionDef.topicTitle}`;
      const topicId = curriculum.topics.get(topicKey) ?? null;
      const sessionIlos = curriculum.ilosByTopic.get(topicKey) ?? [];

      const startsAt = new Date(baseDate);
      startsAt.setDate(startsAt.getDate() + i * 14);
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + 7);

      const sessionId = DashboardSeeder.seedId("session", classId, String(i));

      await this.supabase.from("sessions").insert({
        id: sessionId,
        class_id: classId,
        course_id: courseId,
        topic: sessionDef.topicTitle,
        topic_id: topicId,
        ilo_ids: sessionIlos.map((ilo) => ilo.id),
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        created_by: this.accountIds.get(classDef.ownerEmail),
        last_analyzed_at: null,
      });

      sessionSeeds.push({
        id: sessionId,
        topic: sessionDef.topicTitle,
        topicId,
        iloIds: sessionIlos.map((ilo) => ilo.id),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: "active",
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

  private shuffle<T>(arr: T[]): T[] {
    const pool = [...arr];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }

  private sampleFeedback(count: number): CsvFeedbackRow[] {
    return this.shuffle(this.feedbackPool).slice(0, count);
  }

  private sampleFeedbackWithBias(
    count: number,
    biasIssue: string,
    biasCount: number,
  ): CsvFeedbackRow[] {
    const biased = this.shuffle(this.feedbackPool.filter((r) => r.issue === biasIssue)).slice(
      0,
      biasCount,
    );
    const general = this.shuffle(this.feedbackPool.filter((r) => r.issue !== biasIssue)).slice(
      0,
      count - biasCount,
    );
    return this.shuffle([...biased, ...general]);
  }

  /**
   * Creates ONLY the analyzed feedback rows per session. Pending rows (feedbackCount -
   * analyzedCount) are created separately after analysis so their timestamps land after
   * last_analyzed_at (badge test).
   */
  private async createFeedback(
    classDef: ClassDef,
    sessions: SessionSeed[],
    studentIds: string[],
  ): Promise<{
    feedbackBySession: Map<string, FeedbackSeed[]>;
    usedStudents: Map<string, Set<string>>;
  }> {
    const feedbackBySession = new Map<string, FeedbackSeed[]>();
    const usedStudents = new Map<string, Set<string>>();
    let nextStudentIdx = 0;

    for (let si = 0; si < sessions.length; si++) {
      const session = sessions[si];
      const sessionDef = classDef.sessions[si];
      const count = sessionDef.analyzedCount;
      if (count === 0) {
        feedbackBySession.set(session.id, []);
        usedStudents.set(session.id, new Set());
        continue;
      }

      const sampled =
        sessionDef.biasIssue && sessionDef.biasCount
          ? this.sampleFeedbackWithBias(count, sessionDef.biasIssue, sessionDef.biasCount)
          : this.sampleFeedback(count);
      const feedbacks: FeedbackSeed[] = [];
      const sessionStudents = new Set<string>();

      for (let fi = 0; fi < count; fi++) {
        const row = sampled[fi];
        const studentId = studentIds[nextStudentIdx % studentIds.length];
        nextStudentIdx++;
        sessionStudents.add(studentId);
        const issue = row.issue === "uncategorized" ? "Uncategorized" : row.issue;
        const polarity = row.polarity as "pos" | "neu" | "neg";
        const createdAt = new Date(
          new Date(session.startsAt).getTime() + fi * 3600000,
        ).toISOString();
        const feedbackId = DashboardSeeder.seedId("feedback", session.id, String(fi));

        const { error } = await this.supabase.from("feedback").insert({
          id: feedbackId,
          session_id: session.id,
          content: row.text,
          meta: {
            cleanedText: row.cleaned_text,
            aspects: [{ aspect: TTI_RULES[issue] ?? "Uncategorized", issue, polarity }],
          },
          created_at: createdAt,
        });
        if (error) throw new Error(`Failed to insert feedback: ${error.message}`);

        const { error: partErr } = await this.supabase.from("session_participations").insert({
          session_id: session.id,
          student_id: studentId,
          created_at: createdAt,
        });
        if (partErr) throw new Error(`Failed to insert participation: ${partErr.message}`);

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
      usedStudents.set(session.id, sessionStudents);
    }

    const total = Array.from(feedbackBySession.values()).reduce((s, f) => s + f.length, 0);
    console.log(`  ✓ ${total} analyzed feedback entries created`);
    return { feedbackBySession, usedStudents };
  }

  /**
   * Inserts pending feedback rows with timestamps after last_analyzed_at so the UI
   * renders the "Open analysis (N)" badge. These rows are excluded from analysis.
   */
  private async insertPendingFeedback(
    session: SessionSeed,
    count: number,
    takenStudents: Set<string>,
    studentIds: string[],
  ): Promise<number> {
    const available = studentIds.filter((id) => !takenStudents.has(id));
    const sampled = this.sampleFeedback(count);

    for (let ri = 0; ri < count; ri++) {
      const row = sampled[ri];
      const studentId = available[ri % available.length];
      const issue = row.issue === "uncategorized" ? "Uncategorized" : row.issue;
      const polarity = row.polarity as "pos" | "neu" | "neg";
      const lastAnalyzed = session.lastAnalyzedAt
        ? new Date(session.lastAnalyzedAt).getTime()
        : Date.now();
      const createdAt = new Date(
        Math.min(Date.now(), lastAnalyzed + (ri + 1) * 1000),
      ).toISOString();
      const feedbackId = DashboardSeeder.seedId("feedback", session.id, "pending", String(ri));

      const { error } = await this.supabase.from("feedback").insert({
        id: feedbackId,
        session_id: session.id,
        content: row.text,
        meta: {
          cleanedText: row.cleaned_text,
          aspects: [{ aspect: TTI_RULES[issue] ?? "Uncategorized", issue, polarity }],
        },
        created_at: createdAt,
      });
      if (error) throw new Error(`Failed to insert pending feedback: ${error.message}`);

      const { error: partErr } = await this.supabase.from("session_participations").insert({
        session_id: session.id,
        student_id: studentId,
        created_at: createdAt,
      });
      if (partErr) throw new Error(`Failed to insert pending participation: ${partErr.message}`);
    }

    console.log(`  ✓ ${count} pending feedback entries created (badge test)`);
    return count;
  }

  // Phase 6: Analysis

  /**
   * Runs the shared production algorithm modules (Modules 4-6) for a session and persists
   * analysis_results, feedback_diagnostics, and sessions.last_analyzed_at.
   */
  private async analyzeSession(
    session: SessionSeed,
    feedbacks: FeedbackSeed[],
    ilosByTopic: TopicIloMap,
    courseCode: string,
  ): Promise<number> {
    if (feedbacks.length === 0) return 0;

    const sessionIlos = ilosByTopic.get(`${courseCode}:${session.topic}`) ?? [];

    const maxSessionRbt = sessionIlos.length > 0 ? Math.max(...sessionIlos.map(getIloLevel)) : 1;
    const iloStatement =
      sessionIlos.length > 1
        ? sessionIlos.map((ilo, i) => `ILO ${i + 1}: ${ilo.statement}`).join("; ")
        : (sessionIlos[0]?.statement ?? "Unknown Goal");
    const ilosScope = sessionIlos.map((ilo, index) => ({
      index,
      statement: ilo.statement,
      level: getIloLevel(ilo),
    }));

    const buffer: DiagnosticRecord[] = feedbacks.map((fb) =>
      buildDiagnosticRecord(fb.issue, fb.polarity, maxSessionRbt, fb.id),
    );

    const total = feedbacks.length;

    const sessionContext: SessionContext = {
      course: courseCode,
      topic: session.topic,
      targetIloRbt: maxSessionRbt,
      sessionId: session.id,
      iloStatement,
      ilos: ilosScope,
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

    formatDashboardOutput(recommendationList, warningList, stats);

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

    const gaps = buildIloGapItems(buffer, sessionIlos);

    const finalResult: AnalysisResult = {
      sessionId: session.id,
      totalFeedback: total,
      aspectDist,
      issueDist,
      polarityDist,
      rbtDist,
      cltDist,
      gaps,
      recommendations: recommendationList.map((r) => {
        const issueLabel = ISSUE_RULES[r.issue.toLowerCase()] ?? r.issue;
        return {
          id: r.id,
          paragraph: r.paragraph,
          terms: r.terms as RecommendationTerm[],
          theories: r.theories as Theory[],
          priority: r.priority,
          feedbackTexts: issueToTexts.get(issueLabel),
        };
      }),
      warnings: warningList.map((recommendationItem) => ({
        id: recommendationItem.id,
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
      result: finalResult,
      rules_version: RULES_VERSION,
    });

    const lastAnalyzedAt = new Date().toISOString();
    await this.supabase
      .from("sessions")
      .update({ last_analyzed_at: lastAnalyzedAt })
      .eq("id", session.id);
    session.lastAnalyzedAt = lastAnalyzedAt;

    console.log(
      `  ✓ Analysis result (${feedbacks.length} raw rows, 1 cache row) for "${session.topic}"`,
    );
    return feedbacks.length;
  }

  // Phase 7: Activity logs

  private async seedActivityLogs(curriculum: {
    courses: Map<string, string>;
    topics: Map<string, string>;
    ilos: Map<string, string>;
  }): Promise<void> {
    const now = Date.now();

    for (const def of DashboardSeeder.ACTIVITY_LOGS) {
      const entityId = this.resolveActivityEntityId(def, curriculum);
      if (!entityId) continue;

      const userId = this.accountIds.get(def.userEmail);
      if (!userId) continue;

      const id = DashboardSeeder.seedId(
        "activity",
        def.entity,
        def.entityKey,
        def.action,
        def.label,
      );
      const timestamp = new Date(now - def.daysAgo * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await this.supabase.from("activity_log").insert({
        id,
        entity: def.entity,
        entity_id: entityId,
        action: def.action,
        label: def.label,
        new_label: def.newLabel,
        user_id: userId,
        timestamp,
      });
      if (error) throw new Error(`Failed to insert activity log: ${error.message}`);
    }
  }

  private resolveActivityEntityId(
    def: ActivityLogDef,
    curriculum: {
      courses: Map<string, string>;
      topics: Map<string, string>;
      ilos: Map<string, string>;
    },
  ): string | null {
    if (def.entity === "course") return curriculum.courses.get(def.entityKey) ?? null;
    if (def.entity === "topic") return curriculum.topics.get(def.entityKey) ?? null;
    if (def.entity === "ILO") return curriculum.ilos.get(def.entityKey) ?? null;
    return null;
  }

  // Cleanup

  /**
   * Hard-deletes every entity this seed manages (identified by deterministic IDs),
   * so re-running fully overwrites previous seed data without touching unrelated rows.
   */
  private async cleanupAllSeedData(): Promise<void> {
    const classIds = [...DashboardSeeder.CLASSES, ...DashboardSeeder.DEV_CLASSES].map((c) =>
      DashboardSeeder.seedId("class", c.classIdKey ?? c.courseCode, c.section),
    );
    const courseIds = DashboardSeeder.COURSES.map((c) => DashboardSeeder.seedId("course", c.code));

    const sessionFilter = "session_id = ANY($1::uuid[])";
    const classFilter = "class_id = ANY($1::uuid[])";
    const courseFilter = "course_id = ANY($1::uuid[])";

    // Collect all session IDs for these classes first.
    const { data: sessions } = await this.supabase
      .from("sessions")
      .select("id")
      .in("class_id", classIds);
    const sessionIds = (sessions ?? []).map((s) => s.id);

    const counts = await adminExec([
      {
        text: `DELETE FROM feedback_diagnostics WHERE ${sessionFilter}`,
        params: [sessionIds],
      },
      {
        text: `DELETE FROM analysis_results WHERE ${sessionFilter}`,
        params: [sessionIds],
      },
      {
        text: `DELETE FROM feedback WHERE ${sessionFilter}`,
        params: [sessionIds],
      },
      {
        text: `DELETE FROM submission_tokens WHERE ${sessionFilter}`,
        params: [sessionIds],
      },
      {
        text: `DELETE FROM session_participations WHERE ${sessionFilter}`,
        params: [sessionIds],
      },
      { text: `DELETE FROM sessions WHERE ${classFilter}`, params: [classIds] },
      { text: `DELETE FROM enrollments WHERE ${classFilter}`, params: [classIds] },
      { text: `DELETE FROM classes WHERE id = ANY($1::uuid[])`, params: [classIds] },
      // ILOs and topics must go before their parent course (FK constraints).
      { text: `DELETE FROM ilos WHERE ${courseFilter}`, params: [courseIds] },
      { text: `DELETE FROM topics WHERE ${courseFilter}`, params: [courseIds] },
      { text: `DELETE FROM courses WHERE id = ANY($1::uuid[])`, params: [courseIds] },
      // Scoped activity log cleanup: only the seed's own deterministic IDs.
      {
        text: `DELETE FROM activity_log WHERE id IN (${DashboardSeeder.ACTIVITY_LOGS.map(
          (_, i) => `$${i + 1}`,
        ).join(",")})`,
        params: DashboardSeeder.ACTIVITY_LOGS.map((def) =>
          DashboardSeeder.seedId("activity", def.entity, def.entityKey, def.action, def.label),
        ),
      },
    ]);

    const tableNames = [
      "feedback_diagnostics",
      "analysis_results",
      "feedback",
      "submission_tokens",
      "session_participations",
      "sessions",
      "enrollments",
      "classes",
      "ilos",
      "topics",
      "courses",
      "activity_log",
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
}

new DashboardSeeder().run().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
