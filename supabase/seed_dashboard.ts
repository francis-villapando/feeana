import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  CalculateDistributions,
  GeneratePedagogicalCue,
  GenerateDiagnosticWarning,
} from "../src/lib/algorithm/strategyGeneration";
import {
  TTI_RULES,
  RBT_RULES,
  RBT_LEVELS,
  CLT_RULES,
  ISSUE_RULES,
  RULES_VERSION,
} from "../src/lib/algorithm/rules";
import type { SessionContext, DiagnosticRecord, BufferedDiagnostic, RecommendationItem, WarningItem } from "../src/lib/algorithm/types";
import type { DistEntry, AnalysisResult, GapItem } from "../src/lib/types/types";

// Dashboard Test Seed — 3 Classes, 60 Students, 9 Sessions, ~159 Feedback
//
// Usage: npx tsx --env-file .env supabase/seed_dashboard.ts
//
// Seeds fully deterministic test data into Supabase to verify every
// element of S5.5.2 (KPIs, trend chart, session list badges) without
// running the ML pipeline.
//
// Deterministic: every ID and timestamp is derived from a fixed seed
// so re-running produces identical data every time.

type SeedSupabase = SupabaseClient;

// Deterministic utilities

const SEED_REFERENCE_DATE = new Date("2026-06-18T00:00:00Z");

function seedId(namespace: string, ...parts: string[]): string {
  const hash = createHash("sha256")
    .update([namespace, ...parts].join(":"))
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Config

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FACULTY_EMAIL = "faculty@test.com";

// Issue categories and their pedagogical mappings now imported from rules.ts

// Feedback text pool (Taglish, keyed by issue)

const FEEDBACK_POOL: Record<string, string[]> = {
  "relational coldness": [
    "Parang suplado si sir, tinatanong ko sa Discord pero dinidedma lang ako.",
    "Hindi nagre-reply si Sir sa MS Teams, parang ayaw niya kaming tulungan.",
  ],
  "classroom tension": [
    "Sobrang nakakatakot at high pressure tuwing Q&A, palaging galit si ma'am.",
    "Ang init lagi ng ulo ni Ma'am sa Zoom, nakaka-stress pumasok.",
  ],
  "evaluation unfairness": [
    "Parang ang unfair ng pag-grade, laging may paborito si sir sa section.",
    "Bakit binabaan yung grade ko? Hindi inexpland kung saan ako nagkamali.",
  ],
  "perceived marginalization": [
    "Pakiramdam ko na-ooverlook ako sa class activities, laging yung maiingay lang pinapansin.",
    "Feeling ko invisible ako sa class discussion, kahit nagre-raise hand ako hindi napapansin.",
  ],
  "subject alienation": [
    "Bakit ba natin pinag-aaralan ito? Parang wala namang practical application sa totoong buhay.",
    "Sobrang boring at abstract, feeling ko hindi ko naman ito magagamit sa work.",
  ],
  "peer distraction": [
    "Maingay masyado sa likod habang nagle-lecture, hindi ako makapag-focus.",
    "Yung mga classmates ko sa GC ang ingay, distract na distract ako.",
  ],
  "instructional cadence": [
    "Sobrang bilis magsalita at mag-slide ni sir, hindi ko na ma-follow yung tempo.",
    "Ang bilis mag-next slide ni sir, hindi ko pa nasusundan yung logic.",
  ],
  "clarity deficit": [
    "Ang gulo at malabo mag-explain ni ma'am, walang magandang examples.",
    "Nalilito ako sa explanation, parang lalong sumasakit ulo ko sa gulo.",
  ],
  "abstract logic gap": [
    "Ang hirap intindihin ng logical proofs at algorithms, parang andaming leaps.",
    "Nahihirapan ako i-trace yung recursive calls, parang andaming logic leaps.",
  ],
  "procedural bottleneck": [
    "Nalilito ako sa step-by-step setup ng development environment.",
    "Stuck ako sa installation, andaming errors na hindi ko alam paano i-resolve.",
  ],
  "conceptual misalignment": [
    "Medyo nalilito pa rin ako sa pinagkaiba ng parameters vs arguments.",
    "Akala ko gets ko na yung concept, pero lito pa rin sa application.",
  ],
  "design synthesis failure": [
    "Nahihirapan akong pagsamahin yung visual layout at dynamic backend state.",
    "Hirap i-connect yung database logic sa frontend UI components.",
  ],
  "feedback latency": [
    "Matagal mag-feedback si ma'am, tapos na ang midterms hindi pa chinecheck yung assignments.",
    "Finals na pero yung Lab 2 feedback wala pa rin, hindi namin alam kung tama.",
  ],
  "notation struggle": [
    "Palagi akong sumasablay sa syntax, nakakalimutan ko kung saan dapat ilagay yung curly braces.",
    "Syntax error lagi, hindi ko makuha yung tamang placement ng quotes at aliases.",
  ],
};

const UNCATEGORIZED_FEEDBACK = [
  "Maganda naman ang lesson ngayon, naintindihan ko lahat.",
  "Salamat sir sa extra explanation, malaking tulong.",
  "Masaya ako sa progress ko sa subject na ito.",
];

const BLOOM_LEVELS = { Remember: 1, Understand: 2, Apply: 3, Analyze: 4, Evaluate: 5, Create: 6 } as const;

// Class seed configuration

interface FeedbackDistribution {
  count: number;
  posCount: number;
  neuCount: number;
  negCount: number;
  uncategorizedNeuCount: number;
  negIssues: string[];
}

interface ClassSeedConfig {
  label: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  studentStartIndex: number;
  studentCount: number;
  topicDefs: { title: string }[];
  iloDefs: { topicTitle: string; statement: string; bloomLevel: string }[];
  sessionTopics: string[];
  feedbackDistribution: FeedbackDistribution[];
  analyzeSessionIndices: number[];
  addRecentFeedback: boolean;
}

const CLASS_CONFIGS: ClassSeedConfig[] = [
  {
    label: "TEST-CSEG2",
    courseCode: "TEST-CSEG2",
    courseTitle: "TEST Game Programming 1",
    section: "3CS-C",
    studentStartIndex: 1,
    studentCount: 30,
    topicDefs: [
      { title: "TEST Introduction to Game Programming" },
      { title: "TEST OOP Concepts" },
      { title: "TEST Game Loops & Performance" },
      { title: "TEST Data Structures" },
      { title: "TEST Advanced Topics" },
    ],
    iloDefs: [
      { topicTitle: "TEST Introduction to Game Programming", statement: "TEST Apply fundamental game programming concepts to build a simple interactive application", bloomLevel: "Apply" },
      { topicTitle: "TEST Introduction to Game Programming", statement: "TEST Analyze game mechanics and implement gameplay systems using object-oriented design", bloomLevel: "Analyze" },
      { topicTitle: "TEST OOP Concepts", statement: "TEST Understand inheritance and polymorphism in the context of game object hierarchies", bloomLevel: "Understand" },
      { topicTitle: "TEST OOP Concepts", statement: "TEST Apply design patterns to solve common game development problems", bloomLevel: "Apply" },
      { topicTitle: "TEST Game Loops & Performance", statement: "TEST Remember the structure of a game loop and its key components", bloomLevel: "Remember" },
      { topicTitle: "TEST Game Loops & Performance", statement: "TEST Evaluate performance trade-offs between different game loop implementations", bloomLevel: "Evaluate" },
      { topicTitle: "TEST Data Structures", statement: "TEST Implement linear and non-linear data structures to solve programming problems", bloomLevel: "Apply" },
      { topicTitle: "TEST Data Structures", statement: "TEST Evaluate time and space complexity trade-offs across different data structure choices", bloomLevel: "Evaluate" },
      { topicTitle: "TEST Advanced Topics", statement: "TEST Analyze advanced algorithms for real-time game systems integration and performance", bloomLevel: "Analyze" },
      { topicTitle: "TEST Advanced Topics", statement: "TEST Create a complete game module applying advanced engine architecture patterns", bloomLevel: "Create" },
    ],
    sessionTopics: [
      "TEST Introduction to Game Programming",
      "TEST OOP Concepts",
      "TEST Game Loops & Performance",
      "TEST Data Structures",
      "TEST Advanced Topics",
    ],
    feedbackDistribution: [
      { count: 25, posCount: 2, neuCount: 3, negCount: 20, uncategorizedNeuCount: 1, negIssues: ["relational coldness", "classroom tension", "evaluation unfairness", "clarity deficit", "instructional cadence"] },
      { count: 20, posCount: 4, neuCount: 8, negCount: 8, uncategorizedNeuCount: 2, negIssues: ["conceptual misalignment", "notation struggle", "procedural bottleneck", "peer distraction"] },
      { count: 28, posCount: 14, neuCount: 8, negCount: 6, uncategorizedNeuCount: 2, negIssues: ["subject alienation", "design synthesis failure", "abstract logic gap"] },
      { count: 15, posCount: 2, neuCount: 3, negCount: 10, uncategorizedNeuCount: 1, negIssues: ["feedback latency", "evaluation unfairness", "perceived marginalization", "classroom tension"] },
      { count: 20, posCount: 6, neuCount: 10, negCount: 4, uncategorizedNeuCount: 3, negIssues: ["conceptual misalignment", "notation struggle", "subject alienation"] },
    ],
    analyzeSessionIndices: [0, 1, 2],
    addRecentFeedback: true,
  },
  {
    label: "TEST-CCS106",
    courseCode: "TEST-CCS106",
    courseTitle: "TEST Data Structures & Algorithms",
    section: "3CS-A",
    studentStartIndex: 31,
    studentCount: 15,
    topicDefs: [
      { title: "TEST Arrays & Complexity" },
      { title: "TEST Trees & Recursion" },
    ],
    iloDefs: [
      { topicTitle: "TEST Arrays & Complexity", statement: "TEST Identify different sorting algorithms and their basic operations", bloomLevel: "Remember" },
      { topicTitle: "TEST Arrays & Complexity", statement: "TEST Apply sorting algorithms to organize data efficiently", bloomLevel: "Apply" },
      { topicTitle: "TEST Trees & Recursion", statement: "TEST Understand recursive tree traversal and its computational impact", bloomLevel: "Understand" },
      { topicTitle: "TEST Trees & Recursion", statement: "TEST Analyze time and space complexity of recursive solutions", bloomLevel: "Analyze" },
    ],
    sessionTopics: [
      "TEST Arrays & Complexity",
      "TEST Trees & Recursion",
    ],
    feedbackDistribution: [
      { count: 12, posCount: 2, neuCount: 2, negCount: 8, uncategorizedNeuCount: 1, negIssues: ["procedural bottleneck", "notation struggle", "clarity deficit", "peer distraction"] },
      { count: 10, posCount: 2, neuCount: 2, negCount: 6, uncategorizedNeuCount: 1, negIssues: ["abstract logic gap", "conceptual misalignment", "design synthesis failure"] },
    ],
    analyzeSessionIndices: [0, 1],
    addRecentFeedback: false,
  },
  {
    label: "TEST-CCS112",
    courseCode: "TEST-CCS112",
    courseTitle: "TEST Web Development",
    section: "3CS-B",
    studentStartIndex: 46,
    studentCount: 15,
    topicDefs: [
      { title: "TEST Frontend Basics" },
      { title: "TEST Backend Integration" },
    ],
    iloDefs: [
      { topicTitle: "TEST Frontend Basics", statement: "TEST Apply responsive layout techniques using modern CSS frameworks", bloomLevel: "Apply" },
      { topicTitle: "TEST Frontend Basics", statement: "TEST Create a functional user interface component with interactive features", bloomLevel: "Create" },
      { topicTitle: "TEST Backend Integration", statement: "TEST Understand REST API design patterns for client-server communication", bloomLevel: "Understand" },
      { topicTitle: "TEST Backend Integration", statement: "TEST Analyze client-server data flow and state management approaches", bloomLevel: "Analyze" },
    ],
    sessionTopics: [
      "TEST Frontend Basics",
      "TEST Backend Integration",
    ],
    feedbackDistribution: [
      { count: 14, posCount: 4, neuCount: 4, negCount: 6, uncategorizedNeuCount: 2, negIssues: ["instructional cadence", "clarity deficit", "relational coldness"] },
      { count: 10, posCount: 3, neuCount: 3, negCount: 4, uncategorizedNeuCount: 1, negIssues: ["feedback latency", "evaluation unfairness", "subject alienation"] },
    ],
    analyzeSessionIndices: [0, 1],
    addRecentFeedback: false,
  },
];

// Phase 1: Prerequisites

async function getFacultyId(supabase: SeedSupabase): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", FACULTY_EMAIL)
    .maybeSingle();
  if (data) return data.id;

  const id = seedId("faculty", FACULTY_EMAIL);
  const { data: created } = await supabase
    .from("profiles")
    .insert({ id, email: FACULTY_EMAIL, full_name: "Test Faculty", role: "faculty" })
    .select("id")
    .single();
  if (!created) throw new Error("Failed to create faculty profile");
  return created.id;
}

async function getCourseId(supabase: SeedSupabase, courseCode: string, courseTitle: string): Promise<string> {
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("code", courseCode)
    .maybeSingle();
  if (data) return data.id;

  const id = seedId("course", courseCode);
  const { data: created } = await supabase
    .from("courses")
    .insert({ id, code: courseCode, title: courseTitle })
    .select("id")
    .single();
  if (!created) throw new Error("Failed to create course");
  return created.id;
}

async function getOrCreateTopics(supabase: SeedSupabase, courseId: string, topicDefs: { title: string }[]) {
  const results: { id: string; title: string }[] = [];
  for (const def of topicDefs) {
    const { data: existing } = await supabase
      .from("topics")
      .select("id, title")
      .eq("course_id", courseId)
      .eq("title", def.title)
      .maybeSingle();

    if (existing) {
      results.push(existing);
    } else {
      const id = seedId("topic", courseId, def.title);
      const { data: created } = await supabase
        .from("topics")
        .insert({ id, course_id: courseId, title: def.title })
        .select("id, title")
        .single();
      if (created) results.push(created);
    }
  }
  return results;
}

async function getOrCreateIlos(
  supabase: SeedSupabase,
  courseId: string,
  topics: { id: string; title: string }[],
  iloDefs: { topicTitle: string; statement: string; bloomLevel: string }[],
) {
  const topicMap = new Map(topics.map((t) => [t.title, t.id]));
  const results: { id: string; statement: string; bloomLevel: string; topicId: string }[] = [];

  for (const def of iloDefs) {
    const topicId = topicMap.get(def.topicTitle);
    if (!topicId) continue;

    const { data: existing } = await supabase
      .from("ilos")
      .select("id, statement, bloom_level")
      .eq("course_id", courseId)
      .eq("topic_id", topicId)
      .eq("statement", def.statement)
      .maybeSingle();

    if (existing) {
      results.push({ id: existing.id, statement: existing.statement, bloomLevel: existing.bloom_level, topicId });
    } else {
      const id = seedId("ilo", courseId, def.statement);
      const { data: created } = await supabase
        .from("ilos")
        .insert({ id, course_id: courseId, topic_id: topicId, statement: def.statement, bloom_level: def.bloomLevel })
        .select("id, statement, bloom_level")
        .single();
      if (created) results.push({ id: created.id, statement: created.statement, bloomLevel: created.bloom_level, topicId });
    }
  }
  return results;
}

// Phase 2: Students

async function createStudents(supabase: SeedSupabase, startIndex: number, count: number): Promise<string[]> {
  const ids: string[] = [];

  for (let i = startIndex; i < startIndex + count; i++) {
    const email = `test.student${i}@test.com`;
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      ids.push(existing.id);
    } else {
      const id = seedId("student", email);
      await supabase
        .from("profiles")
        .insert({ id, email, full_name: `Test Student ${i}`, role: "student" });
      ids.push(id);
    }
  }

  console.log(`  ✓ ${ids.length} student profiles ready`);
  return ids;
}

// Phase 3: Class and Enrollments

async function getOrCreateClass(supabase: SeedSupabase, courseId: string, facultyId: string, courseCode: string, section: string): Promise<string> {
  const { data: existing } = await supabase
    .from("classes")
    .select("id")
    .eq("section", section)
    .eq("course", courseCode)
    .maybeSingle();

  if (existing) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id")
      .eq("class_id", existing.id);
    const sessionIds = sessions?.map((s) => s.id) ?? [];
    if (sessionIds.length > 0) {
      await supabase.from("feedback_diagnostics").delete().in("session_id", sessionIds);
      await supabase.from("analysis_results").delete().in("session_id", sessionIds);
      await supabase.from("feedback").delete().in("session_id", sessionIds);
      await supabase.from("sessions").delete().in("id", sessionIds);
    }
    await supabase.from("enrollments").delete().eq("class_id", existing.id);
    await supabase.from("classes").delete().eq("id", existing.id);
  }

  const id = seedId("class", courseCode, section);
  const { data: created } = await supabase
    .from("classes")
    .insert({
      id,
      faculty_id: facultyId,
      course_id: courseId,
      course: courseCode,
      section,
      name: courseCode,
      enroll_code: `${courseCode}-${section.replace(/\s/g, "")}-DBSEED`,
    })
    .select("id")
    .single();

  if (!created) throw new Error("Failed to create class");
  return created.id;
}

async function enrollStudents(supabase: SeedSupabase, classId: string, studentIds: string[]) {
  try {
    await supabase.from("enrollments").delete().eq("class_id", classId);

    const rows = studentIds.map((studentId) => ({ class_id: classId, student_id: studentId }));
    const { error } = await supabase.from("enrollments").insert(rows);
    if (error) throw new Error(`Enrollment error: ${error.message}`);

    await supabase
      .from("classes")
      .update({ student_count: studentIds.length })
      .eq("id", classId);

    console.log(`  ✓ ${studentIds.length} students enrolled`);
  } catch (err) {
    console.error("  ✗ Enrollment failed:", err);
    process.exit(1);
  }
}

// Phase 4: Sessions

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

async function createSessions(
  supabase: SeedSupabase,
  classId: string,
  courseId: string,
  topics: { id: string; title: string }[],
  facultyId: string,
  ilosByTopic: Map<string, { id: string; statement: string; bloomLevel: string }[]>,
  sessionTopics: string[],
  analyzeSessionIndices: number[],
): Promise<SessionSeed[]> {
  const { data: existing } = await supabase.from("sessions").select("id").eq("class_id", classId);
  const existingIds = existing?.map((s) => s.id) ?? [];
  if (existingIds.length > 0) {
    await supabase.from("feedback_diagnostics").delete().in("session_id", existingIds);
    await supabase.from("analysis_results").delete().in("session_id", existingIds);
    await supabase.from("feedback").delete().in("session_id", existingIds);
    await supabase.from("sessions").delete().in("id", existingIds);
  }

  const topicMap = new Map(topics.map((t) => [t.title, t.id]));
  const sessionSeeds: SessionSeed[] = [];

  const baseDate = new Date("2026-01-05T00:00:00Z");

  for (let i = 0; i < sessionTopics.length; i++) {
    const sessionTopic = sessionTopics[i];
    const topicId = topicMap.get(sessionTopic) ?? null;
    const sessionIlos = ilosByTopic.get(sessionTopic) ?? [];

    const startsAt = new Date(baseDate);
    startsAt.setDate(startsAt.getDate() + i * 14);
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + 7);

    let lastAnalyzedAt: string | null;
    if (!analyzeSessionIndices.includes(i)) {
      lastAnalyzedAt = null;
    } else if (i === 0) {
      lastAnalyzedAt = new Date(SEED_REFERENCE_DATE.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      const analyzed = new Date(endsAt);
      analyzed.setDate(analyzed.getDate() + 1);
      lastAnalyzedAt = analyzed.toISOString();
    }

    const sessionId = seedId("session", classId, String(i));

    await supabase.from("sessions").insert({
      id: sessionId,
      class_id: classId,
      course_id: courseId,
      topic: sessionTopic,
      topic_id: topicId,
      ilo_ids: sessionIlos.map((ilo) => ilo.id),
      status: "active",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      created_by: facultyId,
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

interface FeedbackSeed {
  id: string;
  sessionId: string;
  studentId: string;
  content: string;
  issue: string;
  polarity: "pos" | "neu" | "neg";
  createdAt: string;
}

async function createFeedback(
  supabase: SeedSupabase,
  sessions: SessionSeed[],
  studentIds: string[],
  feedbackDistribution: FeedbackDistribution[],
  addRecentFeedback: boolean,
): Promise<Map<string, FeedbackSeed[]>> {
  const feedbackBySession = new Map<string, FeedbackSeed[]>();
  let nextStudentIdx = 0;

  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si];
    const dist = feedbackDistribution[si];
    const feedbacks: FeedbackSeed[] = [];

    const assignedStudents: string[] = [];
    for (let i = 0; i < dist.count; i++) {
      assignedStudents.push(studentIds[nextStudentIdx % studentIds.length]);
      nextStudentIdx++;
    }

    for (let fi = 0; fi < dist.count; fi++) {
      const studentId = assignedStudents[fi];

      let polarity: "pos" | "neu" | "neg";
      if (fi < dist.posCount) polarity = "pos";
      else if (fi < dist.posCount + dist.neuCount) polarity = "neu";
      else polarity = "neg";

      let issue: string;
      let content: string;
      const neuIdx = fi - dist.posCount;

      if (polarity === "pos") {
        issue = "Uncategorized";
        content = UNCATEGORIZED_FEEDBACK[fi % UNCATEGORIZED_FEEDBACK.length];
      } else if (polarity === "neu" && neuIdx < dist.uncategorizedNeuCount) {
        issue = "Uncategorized";
        content = UNCATEGORIZED_FEEDBACK[fi % UNCATEGORIZED_FEEDBACK.length];
      } else {
        let issueIdx: number;
        if (polarity === "neu") {
          issueIdx = (neuIdx - dist.uncategorizedNeuCount) % dist.negIssues.length;
        } else {
          const negIdx = fi - dist.posCount - dist.neuCount;
          issueIdx = negIdx % dist.negIssues.length;
        }
        issue = dist.negIssues[issueIdx];
        const pool = FEEDBACK_POOL[issue];
        content = pool[fi % pool.length];
      }

      const createdAt = new Date(new Date(session.startsAt).getTime() + fi * 3600000).toISOString();

      const feedbackId = seedId("feedback", session.id, String(fi));
      const meta = {
        cleanedText: content.toLowerCase().trim(),
        submittedBy: studentId,
        aspects: [{ aspect: TTI_RULES[issue] ?? "Uncategorized", issue, polarity }],
      };

      await supabase.from("feedback").insert({
        id: feedbackId,
        session_id: session.id,
        content,
        student_id: studentId,
        meta,
        created_at: createdAt,
      });

      feedbacks.push({ id: feedbackId, sessionId: session.id, studentId, content, issue, polarity, createdAt });
    }

    feedbackBySession.set(session.id, feedbacks);
  }

  const total = Array.from(feedbackBySession.values()).reduce((s, f) => s + f.length, 0);
  console.log(`  ✓ ${total} feedback entries created`);

  if (addRecentFeedback && sessions.length > 0) {
    const firstDist = feedbackDistribution[0];
    const recentStart = firstDist.count;
    if (recentStart + 5 <= studentIds.length) {
      const sessionA = sessions[0];
      const existingA = feedbackBySession.get(sessionA.id)!;
      const recentStudents = studentIds.slice(recentStart, recentStart + 5);
      for (let i = 0; i < 5; i++) {
        const studentId = recentStudents[i];
        const content = "Ang hirap ng bagong topic, sana magbigay pa ng examples si sir.";
        const feedbackId = seedId("feedback", sessionA.id, "recent", String(i));
        const createdAt = new Date(SEED_REFERENCE_DATE.getTime() - i * 3600000).toISOString();

        await supabase.from("feedback").insert({
          id: feedbackId,
          session_id: sessionA.id,
          content,
          student_id: studentId,
          meta: {
            cleanedText: content.toLowerCase().trim(),
            submittedBy: studentId,
            aspects: [{ aspect: "Quality of Knowledge", issue: "abstract logic gap", polarity: "neg" }],
          },
          created_at: createdAt,
        });

        existingA.push({ id: feedbackId, sessionId: sessionA.id, studentId, content, issue: "abstract logic gap", polarity: "neg", createdAt });
      }

      console.log(`  ✓ 5 recent feedback entries added to first session (badge test)`);
    }
  }

  return feedbackBySession;
}

// Phase 6: Analysis Results and Diagnostics

interface TopicIloMap extends Map<string, { id: string; statement: string; bloomLevel: string }[]> { }

async function createAnalysisResults(
  supabase: SeedSupabase,
  sessions: SessionSeed[],
  feedbackBySession: Map<string, FeedbackSeed[]>,
  ilosByTopic: TopicIloMap,
  analyzeSessionIndices: number[],
  courseTitle: string,
) {
  const PRIORITY_THRESHOLD = 0.3;

  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si];
    const feedbacks = feedbackBySession.get(session.id);
    if (!feedbacks) continue;

    if (!analyzeSessionIndices.includes(si)) {
      console.log(`  ✓ Session "${session.topic}" left un-analyzed (intentional)`);
      continue;
    }

    const sessionIlos = ilosByTopic.get(session.topic) ?? [];
    const targetRbt = Math.max(1, ...sessionIlos.map((ilo) => BLOOM_LEVELS[ilo.bloomLevel as keyof typeof BLOOM_LEVELS] ?? 1));

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
      course: courseTitle,
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
    const warningList: WarningItem[] = [];

    for (const uniqueIssue of uniqueIssueMap.values()) {
      if (uniqueIssue.issue === "Uncategorized") continue;

      const w_c = uniqueIssue.isGap ? 1.5 : 1.0;
      const P = (uniqueIssue.count / total) * w_c;

      if (P >= PRIORITY_THRESHOLD) {
        recommendationList.push(
          GeneratePedagogicalCue(sessionContext, uniqueIssue, total),
        );
      } else {
        warningList.push(GenerateDiagnosticWarning(uniqueIssue));
      }
    }

    // Module 6: Dashboard Output
    const aspectDist: DistEntry[] = Object.entries(stats.aspectCounts)
      .map(([label, value]) => ({ label, value } as DistEntry))
      .sort((a, b) => b.value - a.value);

    const issueDist: DistEntry[] = Object.entries(stats.issueCounts)
      .map(([key, value]) => ({ label: ISSUE_RULES[key.toLowerCase()] ?? key, value } as DistEntry))
      .sort((a, b) => b.value - a.value);

    const polarityDist: DistEntry[] = [
      { label: "Positive", value: stats.polarityCounts.pos || 0 },
      { label: "Neutral", value: stats.polarityCounts.neu || 0 },
      { label: "Negative", value: stats.polarityCounts.neg || 0 },
    ];

    const rbtDist: DistEntry[] = Object.entries(stats.rbtCounts)
      .map(([label, value]) => ({ label, value } as DistEntry))
      .sort((a, b) => (RBT_LEVELS as readonly string[]).indexOf(a.label) - (RBT_LEVELS as readonly string[]).indexOf(b.label));

    const cltDist: DistEntry[] = Object.entries(stats.cltCounts)
      .map(([label, value]) => ({ label, value } as DistEntry))
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

      const rbtName = diag.issue === "Uncategorized" ? "Uncategorized" : (RBT_LEVELS[diag.rbt] ?? String(diag.rbt));
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
    const polarityLabelKey: Record<string, string> = { Positive: "pos", Neutral: "neu", Negative: "neg" };
    for (const entry of polarityDist) entry.feedbackTexts = polarityToTexts[polarityLabelKey[entry.label]];
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
        id: seedId("recommendation", session.id, r.issue),
        paragraph: r.paragraph,
        terms: r.terms as any[],
        theories: r.theories as any[],
        priority: r.priority,
      })),
      warnings: warningList.map((w) => ({
        id: seedId("warning", session.id, w.issue),
        issue: w.issue,
        count: w.count,
      })),
    };

    await supabase.from("analysis_results").insert(
      feedbacks.map((fb) => ({
        session_id: session.id,
        feedback_id: fb.id,
        issue: fb.issue,
        polarity: fb.polarity,
      }))
    );

    await supabase.from("feedback_diagnostics").insert({
      session_id: session.id,
      result: analysisResult,
      rules_version: RULES_VERSION,
    });

    console.log(`  ✓ Analysis result (${feedbacks.length} raw rows, 1 cache row) for "${session.topic}"`);
  }
}

// Main

async function seedClass(supabase: SeedSupabase, facultyId: string, config: ClassSeedConfig) {
  const prefix = `[${config.label}]`;

  console.log(`\n━━━ ${config.label} ━━━`);

  // Phase 1 per class: Course, Topics, ILOs
  console.log(`${prefix} Course, topics, ILOs...`);
  const courseId = await getCourseId(supabase, config.courseCode, config.courseTitle);
  const topics = await getOrCreateTopics(supabase, courseId, config.topicDefs);
  const ilos = await getOrCreateIlos(supabase, courseId, topics, config.iloDefs);

  const ilosByTopic = new Map<string, { id: string; statement: string; bloomLevel: string; topicId: string }[]>();
  for (const topic of topics) {
    ilosByTopic.set(topic.title, ilos.filter((ilo) => ilo.topicId === topic.id));
  }

  console.log(`  ✓ Course: ${config.courseCode}`);
  console.log(`  ✓ ${topics.length} topics, ${ilos.length} ILOs`);

  // Phase 2: Students
  console.log(`${prefix} Students...`);
  const studentIds = await createStudents(supabase, config.studentStartIndex, config.studentCount);

  // Phase 3: Class & Enrollments
  console.log(`${prefix} Class and enrollments...`);
  const classId = await getOrCreateClass(supabase, courseId, facultyId, config.courseCode, config.section);
  await enrollStudents(supabase, classId, studentIds);

  // Phase 4: Sessions
  console.log(`${prefix} Sessions...`);
  const sessions = await createSessions(
    supabase, classId, courseId, topics, facultyId, ilosByTopic,
    config.sessionTopics, config.analyzeSessionIndices,
  );

  // Phase 5: Feedback
  console.log(`${prefix} Feedback...`);
  const feedbackBySession = await createFeedback(
    supabase, sessions, studentIds,
    config.feedbackDistribution, config.addRecentFeedback,
  );

  // Phase 6: Analysis
  console.log(`${prefix} Analysis...`);
  await createAnalysisResults(supabase, sessions, feedbackBySession, ilosByTopic, config.analyzeSessionIndices, config.courseTitle);

  return {
    studentCount: studentIds.length,
    sessionCount: sessions.length,
    feedbackCount: Array.from(feedbackBySession.values()).reduce((s, f) => s + f.length, 0),
    analyzedCount: config.analyzeSessionIndices.length,
    uncategorizedCount: Array.from(feedbackBySession.values()).flat().filter((f) => f.issue === "Uncategorized").length,
  };
}

async function main() {
  console.log("Dashboard Seed Script\n");
  console.log(`Target: ${CLASS_CONFIGS.length} classes, ${CLASS_CONFIGS.reduce((s, c) => s + c.studentCount, 0)} students, ${CLASS_CONFIGS.reduce((s, c) => s + c.sessionTopics.length, 0)} sessions\n`);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    console.error("Run with: npx tsx --env-file .env supabase/seed_dashboard.ts");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Shared faculty
  console.log("[1] Faculty...");
  const facultyId = await getFacultyId(supabase);
  console.log(`  ✓ Faculty: ${facultyId}`);

  const results: Awaited<ReturnType<typeof seedClass>>[] = [];
  for (const config of CLASS_CONFIGS) {
    const result = await seedClass(supabase, facultyId, config);
    results.push(result);
  }

  const totalStudents = results.reduce((s, r) => s + r.studentCount, 0);
  const totalSessions = results.reduce((s, r) => s + r.sessionCount, 0);
  const totalFeedback = results.reduce((s, r) => s + r.feedbackCount, 0);
  const totalAnalyzed = results.reduce((s, r) => s + r.analyzedCount, 0);
  const totalUncategorized = results.reduce((s, r) => s + r.uncategorizedCount, 0);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Seed Complete");
  console.log("=".repeat(50));
  console.log(`  Classes:       ${CLASS_CONFIGS.length}`);
  console.log(`  Students:      ${totalStudents}`);
  console.log(`  Sessions:      ${totalSessions}`);
  console.log(`  Feedback:      ${totalFeedback}`);
  console.log(`  Analyzed:      ${totalAnalyzed} of ${totalSessions} sessions`);
  console.log(`  Uncategorized: ${totalUncategorized} entries`);
  console.log("");

  for (let i = 0; i < CLASS_CONFIGS.length; i++) {
    const config = CLASS_CONFIGS[i];
    const r = results[i];
    console.log(`  ${config.label}: ${r.sessionCount} sessions, ${r.feedbackCount} feedback, ${r.analyzedCount} analyzed`);
  }

  console.log("");
  console.log("Row counts for verification:");

  // Per-class detail for verification
  for (let i = 0; i < CLASS_CONFIGS.length; i++) {
    const config = CLASS_CONFIGS[i];
    const r = results[i];
    const rowCount = config.feedbackDistribution
      .filter((_, si) => config.analyzeSessionIndices.includes(si))
      .reduce((s, d) => s + d.count, 0);
    const recentCount = config.addRecentFeedback ? 5 : 0;
    console.log(`  ${config.label}:`);
    console.log(`    topics:              ${config.topicDefs.length}`);
    console.log(`    ILOs:                ${config.iloDefs.length}`);
    console.log(`    analysis_results:    ${rowCount + recentCount} rows (feedback across ${config.analyzeSessionIndices.length} analyzed sessions)`);
    console.log(`    feedback_diagnostics: ${config.analyzeSessionIndices.length} rows (1 per analyzed session)`);
  }

  console.log("");
  console.log("Login at /login/faculty with:");
  console.log("  Email:    faculty@test.com");
  console.log("  Password: faculty123");
  console.log("");

  console.log("Expected KPIs (TEST-CSEG2):");
  console.log("  Submission rate: 81%  (avg of 83%,67%,93%)");
  console.log("  ILO achievement: 50%  (avg of 50%,50%,50%)");
  console.log("  Per-session ILO rates: 50%, 50%, 50%");
  console.log("  Active classes:  3");
  console.log("  Active sessions: 9");
  console.log("");

  console.log("Badge test:");
  console.log("  TEST-CSEG2 Session A: 5 new feedback");
  console.log("  TEST-CSEG2 Session D: 15 new feedback (never analyzed)");
  console.log("  TEST-CSEG2 Session E: 20 new feedback (never analyzed)");
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
