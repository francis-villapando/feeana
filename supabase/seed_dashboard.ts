import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Dashboard Test Seed — 30 Students, 5 Sessions, ~115 Feedback
//
// Usage: npx tsx --env-file .env supabase/seed_dashboard.ts
//
// Seeds deterministic test data into Supabase to verify every
// element of S5.5.2 (KPIs, trend chart, session list badges)
// without running the ML pipeline.
//
// Re-run safety: all data rows are deleted-then-inserted so
// running twice produces the same result.

type SeedSupabase = SupabaseClient;

// Config

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FACULTY_EMAIL = "faculty@test.com";
const COURSE_CODE = "TEST-CSEG2";
const CLASS_SECTION = "3CS-C";
const STUDENT_COUNT = 30;

// Issue categories and their pedagogical mappings

interface IssueMeta {
  tti: string;
  rbt: number;
  clt: "Intrinsic" | "Extraneous";
}

const ISSUES: Record<string, IssueMeta> = {
  "relational coldness": { tti: "Positive Climate", rbt: 2, clt: "Extraneous" },
  "classroom tension": { tti: "Teacher Sensitivity", rbt: 3, clt: "Extraneous" },
  "evaluation unfairness": { tti: "Regard for Student Perspectives", rbt: 3, clt: "Extraneous" },
  "perceived marginalization": { tti: "Regard for Student Perspectives", rbt: 2, clt: "Extraneous" },
  "subject alienation": { tti: "Instructional Dialogue", rbt: 4, clt: "Intrinsic" },
  "peer distraction": { tti: "Negative Climate", rbt: 1, clt: "Extraneous" },
  "instructional cadence": { tti: "Instructional Learning Formats", rbt: 3, clt: "Extraneous" },
  "clarity deficit": { tti: "Instructional Learning Formats", rbt: 5, clt: "Extraneous" },
  "abstract logic gap": { tti: "Quality of Knowledge", rbt: 4, clt: "Intrinsic" },
  "procedural bottleneck": { tti: "Quality of Knowledge", rbt: 3, clt: "Intrinsic" },
  "conceptual misalignment": { tti: "Quality of Knowledge", rbt: 4, clt: "Intrinsic" },
  "design synthesis failure": { tti: "Analysis & Problem Solving", rbt: 5, clt: "Intrinsic" },
  "feedback latency": { tti: "Quality of Feedback", rbt: 2, clt: "Extraneous" },
  "notation struggle": { tti: "Instructional Learning Formats", rbt: 3, clt: "Intrinsic" },
};

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

// Phase 1: Prerequisites

async function getFacultyId(supabase: SeedSupabase): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", FACULTY_EMAIL)
    .maybeSingle();
  if (data) return data.id;

  // Faculty does not exist in this environment — create one
  const { data: created } = await supabase
    .from("profiles")
    .insert({ id: crypto.randomUUID(), email: FACULTY_EMAIL, full_name: "Test Faculty", role: "faculty" })
    .select("id")
    .single();
  if (!created) throw new Error("Failed to create faculty profile");
  return created.id;
}

async function getCourseId(supabase: SeedSupabase): Promise<string> {
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("code", COURSE_CODE)
    .maybeSingle();
  if (data) return data.id;

  const { data: created } = await supabase
    .from("courses")
    .insert({ code: COURSE_CODE, title: "TEST Game Programming 1" })
    .select("id")
    .single();
  if (!created) throw new Error("Failed to create course");
  return created.id;
}

async function getOrCreateTopics(supabase: SeedSupabase, courseId: string) {
  const topicDefs = [
    { title: "TEST Introduction to Game Programming" },
    { title: "TEST OOP Concepts" },
    { title: "TEST Game Loops & Performance" },
    { title: "TEST Data Structures" },
    { title: "TEST Advanced Topics" },
  ];

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
      const { data: created } = await supabase
        .from("topics")
        .insert({ course_id: courseId, title: def.title })
        .select("id, title")
        .single();
      if (created) results.push(created);
    }
  }
  return results;
}

async function getOrCreateIlos(supabase: SeedSupabase, courseId: string, topics: { id: string; title: string }[]) {
  const iloDefs = [
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
  ];

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
      const { data: created } = await supabase
        .from("ilos")
        .insert({ course_id: courseId, topic_id: topicId, statement: def.statement, bloom_level: def.bloomLevel })
        .select("id, statement, bloom_level")
        .single();
      if (created) results.push({ id: created.id, statement: created.statement, bloomLevel: created.bloom_level, topicId });
    }
  }
  return results;
}

// Phase 2: Students

async function createStudents(supabase: SeedSupabase): Promise<string[]> {
  const ids: string[] = [];

  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const email = `test.student${i}@test.com`;
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      ids.push(existing.id);
    } else {
      const id = crypto.randomUUID();
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

async function getOrCreateClass(supabase: SeedSupabase, courseId: string, facultyId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("classes")
    .select("id")
    .eq("section", CLASS_SECTION)
    .eq("course", COURSE_CODE)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("classes")
    .insert({
      faculty_id: facultyId,
      course_id: courseId,
      course: COURSE_CODE,
      section: CLASS_SECTION,
      name: COURSE_CODE,
      enroll_code: `${COURSE_CODE}-${CLASS_SECTION.replace(/\s/g, "")}-DBSEED`,
    })
    .select("id")
    .single();

  if (!created) throw new Error("Failed to create class");
  return created.id;
}

async function enrollStudents(supabase: SeedSupabase, classId: string, studentIds: string[]) {
  try {
    // Remove existing enrollments for this class to allow re-run
    await supabase.from("enrollments").delete().eq("class_id", classId);

    const rows = studentIds.map((studentId) => ({ class_id: classId, student_id: studentId }));
    const { error } = await supabase.from("enrollments").insert(rows);
    if (error) throw new Error(`Enrollment error: ${error.message}`);

    // Update student_count on the class (normally done by trigger)
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

const SESSION_TOPICS = [
  "TEST Introduction to Game Programming",
  "TEST OOP Concepts",
  "TEST Game Loops & Performance",
  "TEST Data Structures",
  "TEST Advanced Topics",
];

async function createSessions(
  supabase: SeedSupabase,
  classId: string,
  courseId: string,
  topics: { id: string; title: string }[],
  facultyId: string,
  ilosByTopic: Map<string, { id: string; statement: string; bloomLevel: string }[]>,
): Promise<SessionSeed[]> {
  // Delete old data for re-run safety
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

  // Each session spans 1 week, spaced across 2 months
  const baseDate = new Date("2026-01-05T00:00:00Z");

  for (let i = 0; i < SESSION_TOPICS.length; i++) {
    const sessionTopic = SESSION_TOPICS[i];
    const topicId = topicMap.get(sessionTopic) ?? null;
    const sessionIlos = ilosByTopic.get(sessionTopic) ?? [];

    const startsAt = new Date(baseDate);
    startsAt.setDate(startsAt.getDate() + i * 14); // 2 weeks apart
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + 7);

    let lastAnalyzedAt: string | null;
    if (i >= 3) {
      // Sessions D, E: never analyzed (null)
      lastAnalyzedAt = null;
    } else if (i === 0) {
      // Session A: analyzed 7 days ago
      lastAnalyzedAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Sessions B, C: analyzed 1 day after endsAt (all feedback considered "old")
      const analyzed = new Date(endsAt);
      analyzed.setDate(analyzed.getDate() + 1);
      lastAnalyzedAt = analyzed.toISOString();
    }

    const sessionId = crypto.randomUUID();

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

interface FeedbackDistribution {
  count: number;
  posCount: number;
  neuCount: number;
  negCount: number;
  uncategorizedNeuCount: number;
  negIssues: string[];
}

const FEEDBACK_DISTRIBUTION: FeedbackDistribution[] = [
  { count: 25, posCount: 2, neuCount: 3, negCount: 20, uncategorizedNeuCount: 1, negIssues: ["relational coldness", "classroom tension", "evaluation unfairness", "clarity deficit", "instructional cadence"] },
  { count: 20, posCount: 4, neuCount: 8, negCount: 8, uncategorizedNeuCount: 2, negIssues: ["conceptual misalignment", "notation struggle", "procedural bottleneck", "peer distraction"] },
  { count: 28, posCount: 14, neuCount: 8, negCount: 6, uncategorizedNeuCount: 2, negIssues: ["subject alienation", "design synthesis failure", "abstract logic gap"] },
  { count: 15, posCount: 2, neuCount: 3, negCount: 10, uncategorizedNeuCount: 1, negIssues: ["feedback latency", "evaluation unfairness", "perceived marginalization", "classroom tension"] },
  { count: 20, posCount: 6, neuCount: 10, negCount: 4, uncategorizedNeuCount: 3, negIssues: ["conceptual misalignment", "notation struggle", "subject alienation"] },
];

async function createFeedback(
  supabase: SeedSupabase,
  sessions: SessionSeed[],
  studentIds: string[],
): Promise<Map<string, FeedbackSeed[]>> {
  const feedbackBySession = new Map<string, FeedbackSeed[]>();
  let nextStudentIdx = 0;

  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si];
    const dist = FEEDBACK_DISTRIBUTION[si];
    const feedbacks: FeedbackSeed[] = [];

    // Assign students deterministically (cyclic slice)
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

      // Stagger created_at within the session's date range
      const createdAt = new Date(new Date(session.startsAt).getTime() + fi * 3600000).toISOString();

      const feedbackId = crypto.randomUUID();
      const meta = {
        cleanedText: content.toLowerCase().trim(),
        submittedBy: studentId,
        aspects: [{ aspect: ISSUES[issue]?.tti ?? "Uncategorized", issue, polarity }],
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

  // For Session A: add 5 recent feedback entries (to test badge)
  const sessionA = sessions[0];
  const existingA = feedbackBySession.get(sessionA.id)!;
  // Use students at indices 25-29 (not used in Session A which uses 0-24)
  const recentStudents = studentIds.slice(25, 30);
  for (let i = 0; i < 5; i++) {
    const studentId = recentStudents[i];
    const content = "Ang hirap ng bagong topic, sana magbigay pa ng examples si sir.";
    const feedbackId = crypto.randomUUID();
    const createdAt = new Date(Date.now() - i * 3600000).toISOString(); // recent: within last 5 hours

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

  console.log(`  ✓ 5 recent feedback entries added to Session A (badge test)`);
  return feedbackBySession;
}

// Phase 6: Analysis Results and Diagnostics

interface TopicIloMap extends Map<string, { id: string; statement: string; bloomLevel: string }[]> { }

async function createAnalysisResults(
  supabase: SeedSupabase,
  sessions: SessionSeed[],
  feedbackBySession: Map<string, FeedbackSeed[]>,
  ilosByTopic: TopicIloMap,
) {
  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si];
    const feedbacks = feedbackBySession.get(session.id);
    if (!feedbacks) continue;

    // Skip sessions D, E (index 3, 4) — no analysis result
    if (si >= 3) {
      console.log(`  ✓ Session "${session.topic}" left un-analyzed (intentional)`);
      continue;
    }

    // Compute distributions from the feedback data
    const issueCounts = new Map<string, number>();
    const aspectCounts = new Map<string, number>();
    const polarityCounts = { pos: 0, neu: 0, neg: 0 };
    const gapDiagnostics: { issue: string; feedbackId: string }[] = [];

    for (const fb of feedbacks) {
      issueCounts.set(fb.issue, (issueCounts.get(fb.issue) ?? 0) + 1);
      polarityCounts[fb.polarity]++;

      const issueMeta = ISSUES[fb.issue];
      if (issueMeta) {
        aspectCounts.set(issueMeta.tti, (aspectCounts.get(issueMeta.tti) ?? 0) + 1);

        // isGap = rbt <= targetRbt && clt === "Intrinsic"
        const sessionIlos = ilosByTopic.get(session.topic) ?? [];
        const targetRbt = Math.max(1, ...sessionIlos.map((ilo) => BLOOM_LEVELS[ilo.bloomLevel as keyof typeof BLOOM_LEVELS] ?? 1));
        const isGap = issueMeta.rbt <= targetRbt && issueMeta.clt === "Intrinsic";
        if (isGap) gapDiagnostics.push({ issue: fb.issue, feedbackId: fb.id });
      } else {
        aspectCounts.set("Uncategorized", (aspectCounts.get("Uncategorized") ?? 0) + 1);
      }
    }

    // Build polarity distribution
    const total = feedbacks.length;
    const dist = [
      { label: "Positive", value: polarityCounts.pos },
      { label: "Neutral", value: polarityCounts.neu },
      { label: "Negative", value: polarityCounts.neg },
    ];

    // Build aspect distribution sorted by count descending
    const aspectDist = Array.from(aspectCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // Build issue distribution sorted by count descending
    const issueDisplayNames: Record<string, string> = {
      "relational coldness": "Relational Coldness",
      "classroom tension": "Classroom Tension",
      "evaluation unfairness": "Evaluation Unfairness",
      "perceived marginalization": "Perceived Marginalization",
      "subject alienation": "Subject Alienation",
      "peer distraction": "Peer Distraction",
      "instructional cadence": "Instructional Cadence",
      "clarity deficit": "Clarity Deficit",
      "abstract logic gap": "Abstract Logic Gap",
      "procedural bottleneck": "Procedural Bottleneck",
      "conceptual misalignment": "Conceptual Misalignment",
      "design synthesis failure": "Design Synthesis Failure",
      "feedback latency": "Feedback Latency",
      "notation struggle": "Notation Struggle",
      "Uncategorized": "Uncategorized",
    };

    const issueDist = Array.from(issueCounts.entries())
      .map(([key, value]) => ({ label: issueDisplayNames[key] ?? key, value }))
      .sort((a, b) => b.value - a.value);

    // Build gaps
    const sessionIlos = ilosByTopic.get(session.topic) ?? [];
    const gaps = gapDiagnostics.slice(0, 3).map((g) => ({
      iloId: sessionIlos[0]?.id ?? "",
      expected: sessionIlos[0]?.statement ?? "Unknown",
      actual: `Issue: "${g.issue}" (CLT: Intrinsic, RBT: Level ${ISSUES[g.issue]?.rbt ?? 1})`,
      severity: "medium" as const,
    }));

    // Build recommendations (1 per unique issue with count >= 3)
    const recommendations = Array.from(issueCounts.entries())
      .filter(([issue, count]) => count >= 3 && issue !== "Uncategorized")
      .map(([issue, count]) => {
        const meta = ISSUES[issue];
        const isGap = gapDiagnostics.some((g) => g.issue === issue);
        const priority = Math.round((count / total) * (isGap ? 1.5 : 1.0) * 100) / 100;
        const displayName = issueDisplayNames[issue] ?? issue;

        return {
          id: crypto.randomUUID(),
          paragraph: `Address "${displayName}" — observed in ${count} feedback entries (${Math.round(count / total * 100)}% of responses). ${isGap ? "This is a pedagogical gap that may affect ILO achievement." : "Consider instructional adjustments to reduce this issue."}`,
          terms: [
            { text: displayName, kind: "issue", detail: `Count: ${count} (${Math.round(count / total * 100)}%)` },
            { text: meta?.tti ?? "General", kind: "metric", detail: `TTI: ${meta?.tti ?? "N/A"}` },
            { text: `RBT Level ${meta?.rbt ?? "?"}`, kind: "RBT", detail: `Bloom's level associated with ${displayName}` },
          ],
          theories: ["TTI", "RBT", "CLT"],
          priority,
        };
      });

    // Build warnings (issues with count < 3, excluding Uncategorized)
    const warnings = Array.from(issueCounts.entries())
      .filter(([issue, count]) => count < 3 && issue !== "Uncategorized")
      .map(([issue, count]) => ({
        id: crypto.randomUUID(),
        issue: issueDisplayNames[issue] ?? issue,
        count,
      }));

    const analysisResult = {
      sessionId: session.id,
      totalFeedback: total,
      aspectDist,
      issueDist,
      polarityDist: dist,
      gaps,
      recommendations,
      warnings,
    };

    // Insert per-feedback raw ML output into analysis_results
    await supabase.from("analysis_results").insert(
      feedbacks.map((fb) => ({
        session_id: session.id,
        feedback_id: fb.id,
        issue: fb.issue,
        polarity: fb.polarity,
      }))
    );

    // Insert cached computed result into feedback_diagnostics (1 row per session)
    await supabase.from("feedback_diagnostics").insert({
      session_id: session.id,
      result: analysisResult,
      rules_version: "1.0",
    });

    console.log(`  ✓ Analysis result (${feedbacks.length} raw rows, 1 cache row) for "${session.topic}"`);
  }
}

// Main

async function main() {
  console.log("Dashboard Seed Script\n");
  console.log(`Target: ${STUDENT_COUNT} students, 5 sessions, ~115 feedback entries\n`);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    console.error("Run with: npx tsx --env-file .env supabase/seed_dashboard.ts");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Phase 1: Prerequisites
  console.log("[1/6] Prerequisites (faculty, course, topics, ILOs)...");
  const facultyId = await getFacultyId(supabase);
  const courseId = await getCourseId(supabase);
  const topics = await getOrCreateTopics(supabase, courseId);
  console.log(`  ✓ Faculty: ${facultyId}`);
  console.log(`  ✓ Course: ${courseId}`);
  console.log(`  ✓ Topics: ${topics.map((t) => t.title).join(", ")}`);

  const ilos = await getOrCreateIlos(supabase, courseId, topics);

  // Group ILOs by topic for session assignment
  const ilosByTopic = new Map<string, { id: string; statement: string; bloomLevel: string; topicId: string }[]>();
  for (const topic of topics) {
    ilosByTopic.set(topic.title, ilos.filter((ilo) => ilo.topicId === topic.id));
  }
  console.log(`  ✓ ${ilos.length} ILOs created`);

  // Phase 2: Students
  console.log("\n[2/6] Creating student profiles...");
  const studentIds = await createStudents(supabase);

  // Phase 3: Class & Enrollments
  console.log("\n[3/6] Setting up class and enrollments...");
  const classId = await getOrCreateClass(supabase, courseId, facultyId);
  await enrollStudents(supabase, classId, studentIds);

  // Phase 4: Sessions
  console.log("\n[4/6] Creating sessions...");
  const sessions = await createSessions(supabase, classId, courseId, topics, facultyId, ilosByTopic);

  // Phase 5: Feedback
  console.log("\n[5/6] Creating feedback entries...");
  const feedbackBySession = await createFeedback(supabase, sessions, studentIds);

  // Phase 6: Analysis Results
  console.log("\n[6/6] Creating analysis results and diagnostics...");
  await createAnalysisResults(supabase, sessions, feedbackBySession, ilosByTopic);

  // Summary
  const totalFeedback = Array.from(feedbackBySession.values()).reduce((s, f) => s + f.length, 0);
  console.log("\n" + "=".repeat(50));
  console.log("Seed Complete");
  console.log("=".repeat(50));
  console.log(`  Students:      ${studentIds.length}`);
  console.log(`  Sessions:      ${sessions.length}`);
  console.log(`  Feedback:      ${totalFeedback}`);
  console.log(`  Analyzed:      3 of ${sessions.length} sessions`);
  console.log(`  Uncategorized: ${Array.from(feedbackBySession.values()).flat().filter((f) => f.issue === "Uncategorized").length} entries`);
  console.log("");
  console.log("Row counts for verification:");
  console.log("  topics:               5");
  console.log("  ILOs:                 10");
  console.log("  analysis_results:     78 rows (all feedback across 3 analyzed sessions)");
  console.log("  feedback_diagnostics: 3 rows (1 per analyzed session, via JSONB result)");
  console.log("");
  console.log("Login at /login/faculty with:");
  console.log("  Email:    faculty@test.com");
  console.log("  Password: faculty123");
  console.log("");
console.log("Expected KPIs:");
console.log("  Submission rate: 81%  (avg of 83%,67%,93%)");
console.log("  ILO achievement: 50%  (avg of 50%,50%,50%)");
console.log("  Per-session ILO rates: 50%, 50%, 50%");
  console.log("  Active classes:  1");
  console.log("  Active sessions: 5");
  console.log("");
console.log("Badge test:");
console.log("  Session A: 5 new feedback");
console.log("  Session D: 15 new feedback (never analyzed)");
console.log("  Session E: 20 new feedback (never analyzed)");
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
