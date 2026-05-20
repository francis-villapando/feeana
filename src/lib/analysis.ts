/**
 * Analysis pipeline.
 * Persists results and individual feedback diagnostics to Supabase.
 */
import type { AnalysisResult } from "./types";
import { supabase } from "./supabase";
import { runAlgorithmPipeline } from "./algorithm/pipeline";

const RESULTS: Record<string, AnalysisResult> = {
  "session-vars": {
    sessionId: "session-vars",
    totalFeedback: 12,
    pedagogicalCount: 10,
    aspectDist: [
      { label: "Pacing", value: 4 },
      { label: "Content", value: 5 },
      { label: "Examples", value: 3 },
      { label: "Materials", value: 1 },
      { label: "Practice", value: 1 },
      { label: "Engagement", value: 1 },
      { label: "Delivery", value: 1 },
    ],
    issueDist: [
      { label: "Typecasting unclear", value: 3 },
      { label: "Too fast", value: 3 },
      { label: "Slide overload", value: 1 },
      { label: "Type confusion", value: 1 },
      { label: "Need error examples", value: 1 },
      { label: "Need step-by-step", value: 1 },
      { label: "Insufficient exercises", value: 1 },
    ],
    polarityDist: [
      { label: "Negative", value: 8 },
      { label: "Neutral", value: 3 },
      { label: "Positive", value: 5 },
    ],
    gaps: [
      {
        iloId: "ilo-1",
        expected:
          "Apply primitive data types and variable declarations to solve simple computational problems.",
        actual: "Students can declare variables but struggle to apply typecasting in I/O contexts.",
        severity: "medium",
      },
      {
        iloId: "ilo-2",
        expected: "Analyze type-conversion and scoping behavior in short Python programs.",
        actual: "Recurring confusion between string and integer types when reading input.",
        severity: "high",
      },
    ],
    recommendations: [
      {
        id: "rec-1",
        priority: 3,
        theories: ["RBT", "CLT"],
        paragraph:
          "Majority of the class is confused with typecasting. RBT suggests that students are having difficulty in applying their idea on the topic, while CLT points the cause to high intrinsic load. It is recommended to provide worked examples of the current topic and utilize scaffolding to bridge the gap toward the intended learning outcome.",
        terms: [
          {
            text: "confused",
            kind: "issue",
            detail:
              "Identified issue: students reported difficulty understanding typecasting concepts during the session.",
          },
          {
            text: "typecasting",
            kind: "aspect",
            detail:
              "Aspect: a specific content area extracted from feedback — here, type conversion between primitive types.",
          },
          {
            text: "applying",
            kind: "RBT",
            detail:
              "Revised Bloom's Taxonomy — Apply level: using learned concepts in new situations. Students struggle to operationalize typecasting rules in code.",
          },
          {
            text: "intrinsic load",
            kind: "CLT",
            detail:
              "Cognitive Load Theory — intrinsic load refers to the inherent complexity of the material. Type conversion involves multiple interacting concepts (types, casts, I/O), driving load high for novices.",
          },
          {
            text: "intended learning outcome",
            kind: "ILO",
            detail: "",
            iloId: "ilo-1",
          },
        ],
      },
      {
        id: "rec-2",
        priority: 3,
        theories: ["CLT", "TTI"],
        paragraph:
          "Pacing was reported as too fast across multiple feedbacks. CLT explains this as extraneous load from rapid delivery exceeding working memory capacity. From a Teaching Through Interactions lens, instructional support drops when there's no time for concept development. Slowing down key transitions and inserting brief comprehension checks is recommended.",
        terms: [
          {
            text: "too fast",
            kind: "issue",
            detail:
              "Identified issue: students explicitly flagged pacing as outpacing their ability to follow.",
          },
          {
            text: "Pacing",
            kind: "aspect",
            detail: "Aspect: how time is allocated and transitions are managed during the session.",
          },
          {
            text: "extraneous load",
            kind: "CLT",
            detail:
              "Cognitive Load Theory — extraneous load is mental effort that does not contribute to learning. Rapid delivery without pauses inflates it.",
          },
          {
            text: "instructional support",
            kind: "TTI",
            detail:
              "Teaching Through Interactions — instructional support covers concept development, quality of feedback, and language modeling. It weakens when pacing prevents elaboration.",
          },
        ],
      },
      {
        id: "rec-3",
        priority: 1,
        theories: ["CLT"],
        paragraph:
          "Slide overload was raised in feedback. CLT recommends reducing extraneous load by replacing dense slides with paired worked examples that show problem and solution side-by-side, freeing working memory for schema construction.",
        terms: [
          {
            text: "Slide overload",
            kind: "issue",
            detail:
              "Identified issue: too much information per slide, making it hard to track key concepts.",
          },
          {
            text: "extraneous load",
            kind: "CLT",
            detail:
              "Cognitive Load Theory — extraneous load is mental effort unrelated to building understanding. Cluttered slides drive it up.",
          },
        ],
      },
    ],
  },
  "session-control": {
    sessionId: "session-control",
    totalFeedback: 12,
    pedagogicalCount: 11,
    aspectDist: [
      { label: "Content", value: 5 },
      { label: "Practice", value: 3 },
      { label: "Pacing", value: 1 },
      { label: "Delivery", value: 2 },
      { label: "Examples", value: 1 },
      { label: "Engagement", value: 1 },
      { label: "Overall", value: 1 },
    ],
    issueDist: [
      { label: "Nested loops confusing", value: 2 },
      { label: "Loop choice unclear", value: 1 },
      { label: "Workload too heavy", value: 1 },
      { label: "Need trace exercises", value: 1 },
      { label: "Need real-world examples", value: 1 },
      { label: "Rushed near end", value: 1 },
      { label: "Abstract", value: 1 },
    ],
    polarityDist: [
      { label: "Negative", value: 6 },
      { label: "Neutral", value: 3 },
      { label: "Positive", value: 6 },
    ],
    gaps: [
      {
        iloId: "ilo-3",
        expected: "Construct conditional and iterative control structures to model decision logic.",
        actual:
          "Students confidently build if-else and single loops; nested loop construction remains shaky.",
        severity: "medium",
      },
      {
        iloId: "ilo-4",
        expected: "Evaluate the correctness of loops by tracing variable state across iterations.",
        actual: "Multiple students explicitly request trace exercises.",
        severity: "high",
      },
    ],
    recommendations: [
      {
        id: "rec-5",
        priority: 2,
        theories: ["RBT", "CLT"],
        paragraph:
          "Many students reported nested loops as confusing. RBT places nested-loop construction at the analyzing level, requiring decomposition skills students haven't yet built. CLT identifies high intrinsic load when multiple loop variables interact. Introducing structured trace tables reduces working memory demand and supports schema formation toward the intended learning outcome.",
        terms: [
          {
            text: "confusing",
            kind: "issue",
            detail:
              "Identified issue: students cannot mentally simulate nested iteration to predict outcomes.",
          },
          {
            text: "nested loops",
            kind: "aspect",
            detail: "Aspect: control flow construct where one loop is contained inside another.",
          },
          {
            text: "analyzing",
            kind: "RBT",
            detail:
              "Revised Bloom's Taxonomy — Analyze level: breaking material into parts and detecting how parts relate. Required to reason about nested iteration.",
          },
          {
            text: "intrinsic load",
            kind: "CLT",
            detail:
              "Cognitive Load Theory — intrinsic load reflects inherent complexity. Tracking inner + outer loop variables simultaneously drives it up.",
          },
          {
            text: "intended learning outcome",
            kind: "ILO",
            detail: "",
            iloId: "ilo-3",
          },
        ],
      },
      {
        id: "rec-6",
        priority: 1,
        theories: ["TTI"],
        paragraph:
          "Feedback flagged the material as abstract. Teaching Through Interactions emphasizes concept development through authentic, relatable examples. Embedding 2 real-world loop scenarios (grading sheet, attendance tally) before introducing nested iteration is recommended.",
        terms: [
          {
            text: "abstract",
            kind: "issue",
            detail:
              "Identified issue: students perceive the topic as disconnected from real applications.",
          },
          {
            text: "concept development",
            kind: "TTI",
            detail:
              "Teaching Through Interactions — concept development uses analysis, integration, and connections to real-world contexts to deepen understanding.",
          },
        ],
      },
      {
        id: "rec-7",
        priority: 1,
        theories: ["CLT"],
        paragraph:
          "Students requested trace exercises. CLT supports this through external representations that offload working memory during multi-step reasoning. Provide a structured trace table template (iteration · condition · variable state) for the next lab.",
        terms: [
          {
            text: "trace exercises",
            kind: "issue",
            detail:
              "Identified issue: students lack structured practice for stepping through code execution.",
          },
          {
            text: "working memory",
            kind: "CLT",
            detail:
              "Cognitive Load Theory — working memory has limited capacity (~4 chunks). External scaffolds free capacity for reasoning rather than tracking.",
          },
        ],
      },
    ],
  },
};

/** Unified mock analysis result for all sessions — demonstration purposes. */
const UNIFIED_RESULT: AnalysisResult = {
  sessionId: "unified",
  totalFeedback: 24,
  pedagogicalCount: 21,
  aspectDist: [
    { label: "Pacing", value: 8 },
    { label: "Content", value: 10 },
    { label: "Examples", value: 6 },
    { label: "Materials", value: 4 },
    { label: "Practice", value: 5 },
    { label: "Engagement", value: 3 },
    { label: "Delivery", value: 4 },
  ],
  issueDist: [
    { label: "Too fast", value: 6 },
    { label: "Typecasting unclear", value: 5 },
    { label: "Need more examples", value: 4 },
    { label: "Slide overload", value: 3 },
    { label: "Abstract concepts", value: 3 },
    { label: "Insufficient practice", value: 2 },
    { label: "Need step-by-step", value: 1 },
  ],
  polarityDist: [
    { label: "Negative", value: 12 },
    { label: "Neutral", value: 6 },
    { label: "Positive", value: 6 },
  ],
  gaps: [
    {
      iloId: "ilo-1",
      expected:
        "Understand the history of game programming.",
      actual:
        "Students can recall major milestones but struggle to connect historical evolution to modern practices.",
      severity: "medium",
    },
    {
      iloId: "ilo-2",
      expected: "Understand the era of computer.",
      actual:
        "Students recognize key computing eras but difficulty linking technological advances to software evolution.",
      severity: "medium",
    },
    {
      iloId: "ilo-3",
      expected: "Understand of Artificial Intelligence.",
      actual:
        "Students grasp basic AI concepts but misconceptions remain about modern AI capabilities and limitations.",
      severity: "high",
    },
  ],
  recommendations: [
    {
      id: "rec-1",
      priority: 3,
      theories: ["RBT", "CLT"],
      paragraph:
        "Majority of the class is confused with typecasting. RBT suggests that students are having difficulty in applying their idea on the topic, while CLT points the cause to high intrinsic load. It is recommended to provide worked examples of the current topic and utilize scaffolding to bridge the gap toward the intended learning outcome.",
      terms: [
        {
          text: "confused",
          kind: "issue",
          detail:
            "Identified issue: students reported difficulty understanding typecasting concepts during the session.",
        },
        {
          text: "typecasting",
          kind: "aspect",
          detail:
            "Aspect: a specific content area extracted from feedback — here, type conversion between primitive types.",
        },
        {
          text: "applying",
          kind: "RBT",
          detail:
            "Revised Bloom's Taxonomy — Apply level: using learned concepts in new situations. Students struggle to operationalize typecasting rules in code.",
        },
        {
          text: "intrinsic load",
          kind: "CLT",
          detail:
            "Cognitive Load Theory — intrinsic load refers to the inherent complexity of the material. Type conversion involves multiple interacting concepts (types, casts, I/O), driving load high for novices.",
        },
        {
          text: "intended learning outcome",
          kind: "ILO",
          detail: "",
          iloId: "ilo-1",
        },
      ],
    },
    {
      id: "rec-2",
      priority: 3,
      theories: ["CLT", "TTI"],
      paragraph:
        "Pacing was reported as too fast across multiple feedbacks. CLT explains this as extraneous load from rapid delivery exceeding working memory capacity. From a Teaching Through Interactions lens, instructional support drops when there's no time for concept development. Slowing down key transitions and inserting brief comprehension checks is recommended.",
      terms: [
        {
          text: "too fast",
          kind: "issue",
          detail:
            "Identified issue: students explicitly flagged pacing as outpacing their ability to follow.",
        },
        {
          text: "Pacing",
          kind: "aspect",
          detail: "Aspect: how time is allocated and transitions are managed during the session.",
        },
        {
          text: "extraneous load",
          kind: "CLT",
          detail:
            "Cognitive Load Theory — extraneous load is mental effort that does not contribute to learning. Rapid delivery without pauses inflates it.",
        },
        {
          text: "instructional support",
          kind: "TTI",
          detail:
            "Teaching Through Interactions — instructional support covers concept development, quality of feedback, and language modeling. It weakens when pacing prevents elaboration.",
        },
      ],
    },
    {
      id: "rec-3",
      priority: 2,
      theories: ["RBT", "CLT"],
      paragraph:
        "Many students reported nested loops as confusing. RBT places nested-loop construction at the analyzing level, requiring decomposition skills students haven't yet built. CLT identifies high intrinsic load when multiple loop variables interact. Introducing structured trace tables reduces working memory demand and supports schema formation toward the intended learning outcome.",
      terms: [
        {
          text: "confusing",
          kind: "issue",
          detail:
            "Identified issue: students cannot mentally simulate nested iteration to predict outcomes.",
        },
        {
          text: "nested loops",
          kind: "aspect",
          detail: "Aspect: control flow construct where one loop is contained inside another.",
        },
        {
          text: "analyzing",
          kind: "RBT",
          detail:
            "Revised Bloom's Taxonomy — Analyze level: breaking material into parts and detecting how parts relate. Required to reason about nested iteration.",
        },
        {
          text: "intrinsic load",
          kind: "CLT",
          detail:
            "Cognitive Load Theory — intrinsic load reflects inherent complexity. Tracking inner + outer loop variables simultaneously drives it up.",
        },
        {
          text: "intended learning outcome",
          kind: "ILO",
          detail: "",
          iloId: "ilo-3",
        },
      ],
    },
    {
      id: "rec-4",
      priority: 1,
      theories: ["CLT"],
      paragraph:
        "Slide overload was raised in feedback. CLT recommends reducing extraneous load by replacing dense slides with paired worked examples that show problem and solution side-by-side, freeing working memory for schema construction.",
      terms: [
        {
          text: "Slide overload",
          kind: "issue",
          detail:
            "Identified issue: too much information per slide, making it hard to track key concepts.",
        },
        {
          text: "extraneous load",
          kind: "CLT",
          detail:
            "Cognitive Load Theory — extraneous load is mental effort unrelated to building understanding. Cluttered slides drive it up.",
        },
      ],
    },
  ],
};

/** Threshold for issue significance — issues at or above this count yield a recommendation. */
export const ISSUE_THRESHOLD = 1;

/** Retrieves existing analysis result from Supabase */
export async function fetchAnalysisResult(sessionId: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching analysis result:", error);
    throw new Error(error.message);
  }

  if (!data || !data.result) return null;

  return data.result as AnalysisResult;
}

/** Executes the algorithm pipeline and saves results to Supabase */
export async function runAnalysis(sessionId: string): Promise<AnalysisResult> {
  console.debug("[analysis] Triggering analysis for session", { sessionId });

  // 1. Fetch class session data along with its class and course details
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("*, classes(name, course, course_id)")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    console.error("Error fetching session details:", sessionErr);
    throw new Error(sessionErr?.message || "Session not found.");
  }

  const courseId = session.course_id || (session.classes as any)?.course_id;
  if (!courseId) {
    throw new Error("Course context not found for this session.");
  }

  // 2. Fetch the target ILOs for this course to calculate the session's active RBT target level
  const { data: ilosData, error: ilosErr } = await supabase
    .from("ilos")
    .select("*")
    .eq("course_id", courseId)
    .eq("archived", false);

  if (ilosErr) {
    console.error("Error fetching course ILOs:", ilosErr);
    throw new Error(ilosErr.message);
  }

  // Calculate session's target RBT level from its active ILOs
  const sessionIloIds = Array.isArray(session.ilo_ids) ? session.ilo_ids : [];
  const activeIlos = (ilosData ?? []).filter(ilo => sessionIloIds.includes(ilo.id));

  const bloomLevelMap: Record<string, number> = {
    "Remember": 1,
    "Understand": 2,
    "Apply": 3,
    "Analyze": 4,
    "Evaluate": 5,
    "Create": 6
  };

  let targetIloRbt = 1; // Default fallback level
  if (activeIlos.length > 0) {
    const rbtLevels = activeIlos.map(ilo => bloomLevelMap[ilo.bloom_level] ?? 1);
    targetIloRbt = Math.max(...rbtLevels);
  }

  // 3. Fetch the actual raw student comments (feedback stream)
  const { data: feedbackData, error: feedbackErr } = await supabase
    .from("feedback")
    .select("*")
    .eq("session_id", sessionId);

  if (feedbackErr) {
    console.error("Error fetching session feedback comments:", feedbackErr);
    throw new Error(feedbackErr.message);
  }

  const feedbackStream = (feedbackData ?? []).map(f => ({
    id: f.id,
    rawText: f.content,
    createdAt: f.created_at
  }));

  // Fetch course name
  const { data: courseData } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .maybeSingle();
  const courseName = courseData?.title || (session.classes as any)?.course || "Unknown Course";

  // 4. Formulate the SessionContext and run the modular pipeline orchestrator
  const sessionContext = {
    course: courseName,
    topic: session.topic || "Unknown Topic",
    targetIloRbt: targetIloRbt,
    sessionId: sessionId
  };

  const pipelineOutput = await runAlgorithmPipeline(sessionContext, feedbackStream);
  const buffer = pipelineOutput.diagnostics ?? [];

  // 5. Calculate distribution metrics to construct the final UI AnalysisResult payload
  const aspectCounts: Record<string, number> = {};
  const polarityCounts = { pos: 0, neu: 0, neg: 0 };

  for (const diag of buffer) {
    aspectCounts[diag.tti] = (aspectCounts[diag.tti] || 0) + 1;
    if (diag.polarity === "pos" || diag.polarity === "neu" || diag.polarity === "neg") {
      polarityCounts[diag.polarity]++;
    }
  }

  const aspectDist = Object.entries(aspectCounts).map(([label, value]) => ({ label, value }));
  const issueDist = Object.entries(pipelineOutput.stats.issueCounts).map(([label, value]) => ({ label, value }));
  
  const polarityDist = [
    { label: "Positive", value: polarityCounts.pos },
    { label: "Neutral", value: polarityCounts.neu },
    { label: "Negative", value: polarityCounts.neg }
  ];

  // Construct Gap items corresponding to live active session ILO statements
  const gaps: any[] = [];
  const gapDiagnostics = buffer.filter(d => d.isGap);
  for (const gapDiag of gapDiagnostics) {
    const ilo = activeIlos[0]; // Associate gap with primary session ILO for now
    if (ilo) {
      gaps.push({
        iloId: ilo.id,
        expected: ilo.statement,
        actual: `Issue: "${gapDiag.issue}" (CLT: ${gapDiag.clt}, RBT: Level ${gapDiag.rbt})`,
        severity: "medium"
      });
    }
  }

  // Map recommendations
  const recommendations = pipelineOutput.recommendationList.map(rec => ({
    id: rec.id,
    paragraph: rec.paragraph,
    terms: [] as any[], // empty for now (safe rendering)
    theories: rec.theories as any[],
    priority: rec.priority
  }));

  const finalResult: AnalysisResult = {
    sessionId,
    totalFeedback: pipelineOutput.stats.totalFeedback,
    pedagogicalCount: pipelineOutput.stats.totalFeedback, // assume all for tracer stub
    aspectDist,
    issueDist,
    polarityDist,
    gaps,
    recommendations
  };

  // 6. DB Integration: Save aggregate result to analysis_results
  // Delete first to avoid conflicts in case unique constraint is not present
  await supabase
    .from("analysis_results")
    .delete()
    .eq("session_id", sessionId);

  const { error: insertErr } = await supabase
    .from("analysis_results")
    .insert({
      session_id: sessionId,
      result: finalResult,
      is_mock: false,
      model_version: "DistilXLM-R (Tracer Stub)"
    });

  if (insertErr) {
    console.error("Error saving aggregate analysis results:", insertErr);
    throw new Error(insertErr.message);
  }

  // 7. DB Integration: Save individual diagnostic records to feedback_diagnostics
  await supabase
    .from("feedback_diagnostics")
    .delete()
    .eq("session_id", sessionId);

  if (buffer.length > 0) {
    const diagnosticsInsert = buffer.map(diag => ({
      feedback_id: diag.feedbackId,
      session_id: sessionId,
      tti: diag.tti,
      rbt: diag.rbt,
      clt: diag.clt,
      issue: diag.issue,
      polarity: diag.polarity,
      is_gap: diag.isGap
    }));

    const { error: diagnosticsErr } = await supabase
      .from("feedback_diagnostics")
      .insert(diagnosticsInsert);

    if (diagnosticsErr) {
      console.error("Error saving feedback diagnostics:", diagnosticsErr);
      // Non-blocking error for tracer, but log it
    }
  }

  console.debug("[analysis] Successfully saved analysis results and diagnostics.", { sessionId });
  return finalResult;
}
