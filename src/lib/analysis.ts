/**
 * Analysis pipeline mock.
 * Replace with real backend calls when ready.
 */
import type { AnalysisResult } from "./types";

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
        actual:
          "Students can declare variables but struggle to apply typecasting in I/O contexts.",
        severity: "medium",
      },
      {
        iloId: "ilo-2",
        expected:
          "Analyze type-conversion and scoping behavior in short Python programs.",
        actual:
          "Recurring confusion between string and integer types when reading input.",
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
            detail:
              "Aspect: how time is allocated and transitions are managed during the session.",
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
        expected:
          "Construct conditional and iterative control structures to model decision logic.",
        actual:
          "Students confidently build if-else and single loops; nested loop construction remains shaky.",
        severity: "medium",
      },
      {
        iloId: "ilo-4",
        expected:
          "Evaluate the correctness of loops by tracing variable state across iterations.",
        actual:
          "Multiple students explicitly request trace exercises.",
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
            detail:
              "Aspect: control flow construct where one loop is contained inside another.",
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

/** Threshold for issue significance — issues at or above this count yield a recommendation. */
export const ISSUE_THRESHOLD = 1;

/** Simulated analysis call. */
export async function runAnalysis(
  sessionId: string,
): Promise<AnalysisResult> {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const result = RESULTS[sessionId];
  if (!result) {
    // Synthesize a minimal result so newly-created sessions still produce output.
    return {
      sessionId,
      totalFeedback: 0,
      pedagogicalCount: 0,
      aspectDist: [],
      issueDist: [],
      polarityDist: [],
      gaps: [],
      recommendations: [
        {
          id: `rec-default-${sessionId}`,
          priority: 1,
          theories: ["TTI"],
          paragraph:
            "No analyzed feedback yet for this session. Once students submit responses and the analysis is run, recommendations will surface here.",
          terms: [],
        },
      ],
    };
  }
  return result;
}
