/**
 * Analysis pipeline mock.
 * Replace these functions with FastAPI/XLM-RoBERTa calls when the backend is ready.
 */
import type { AnalysisMode, AnalysisResult } from "./types";

const ONLINE_RESULTS: Record<string, AnalysisResult> = {
  "session-vars": {
    sessionId: "session-vars",
    mode: "online",
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
          "Recurring confusion between string and integer types when reading input — analysis depth not reached.",
        severity: "high",
      },
    ],
    recommendations: [
      {
        id: "rec-1",
        cue: "Insert a 5-minute board walkthrough of int↔float casting before the next lab to reduce extraneous load.",
        theory: "CLT",
        theoryDetail:
          "Cognitive Load Theory: pre-teach the schema for type conversion to lower extraneous load before practice.",
        triggerPattern:
          "3 feedbacks reporting 'typecasting unclear' + 3 reporting 'pacing too fast' on the same aspect.",
      },
      {
        id: "rec-2",
        cue: "Reformulate the ILO assessment to require students to predict the type of input() return values before running code.",
        theory: "RBT",
        theoryDetail:
          "Revised Bloom's Taxonomy: shift activity from Apply to Analyze, matching ILO-2's intended cognitive level.",
        triggerPattern:
          "Repeated 'string vs integer with input()' confusions across 2 distinct learners.",
      },
      {
        id: "rec-3",
        cue: "Replace dense slides with worked-example pairs and add 2 targeted casting drills to the next lab.",
        theory: "CLT",
        theoryDetail:
          "Worked-example effect reduces problem-solving load while building schema, especially for novices.",
        triggerPattern:
          "Slide overload feedback co-occurring with practice insufficiency complaints.",
      },
      {
        id: "rec-4",
        cue: "Open the next session with a 3-question warm-up poll on naming + casting to reactivate prior knowledge.",
        theory: "TTI",
        theoryDetail:
          "Teaching Through Interactions: emphasize Instructional Support via concept development and feedback loops.",
        triggerPattern:
          "Positive engagement feedback on Q&A suggests learners respond well to interaction.",
      },
    ],
  },
  "session-control": {
    sessionId: "session-control",
    mode: "online",
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
          "Multiple students explicitly request trace exercises — Evaluate-level competency not yet achieved.",
        severity: "high",
      },
    ],
    recommendations: [
      {
        id: "rec-5",
        cue: "Dedicate one micro-lesson to a side-by-side while/for decision tree with 3 paired examples.",
        theory: "RBT",
        theoryDetail:
          "Bloom's Apply→Analyze: comparing constructs requires analyzing differences, the right level for ILO-3.",
        triggerPattern:
          "Direct feedback: 'don't know when to use while vs for'.",
      },
      {
        id: "rec-6",
        cue: "Introduce structured loop-trace tables (iteration, condition, vars) as required scaffolding for the next lab.",
        theory: "CLT",
        theoryDetail:
          "External representation reduces working-memory load during multi-step reasoning.",
        triggerPattern:
          "Two requests for trace exercises + nested-loop confusion clustering.",
      },
      {
        id: "rec-7",
        cue: "Embed 2 real-world loop scenarios (grading sheet, attendance) before introducing nested iteration.",
        theory: "TTI",
        theoryDetail:
          "Concept Development: connect abstract constructs to authentic contexts to deepen understanding.",
        triggerPattern:
          "Repeated 'abstract' + 'need real-world examples' co-occurrence.",
      },
    ],
  },
};

const OFFLINE_RESULTS: Record<string, AnalysisResult> = {
  "session-vars": {
    sessionId: "session-vars",
    mode: "offline",
    totalFeedback: 12,
    pedagogicalCount: 10,
    aspectDist: [
      { label: "Pacing", value: 4 },
      { label: "Content", value: 5 },
      { label: "Examples", value: 3 },
      { label: "Other", value: 4 },
    ],
    issueDist: [
      { label: "Typecasting unclear", value: 3 },
      { label: "Too fast", value: 3 },
      { label: "Slide overload", value: 1 },
      { label: "Type confusion", value: 1 },
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
          "Difficulty applying typecasting consistently in lab exercises.",
        severity: "medium",
      },
    ],
    recommendations: [
      {
        id: "rec-off-1",
        cue: "Slow down the casting walkthrough and add a recap of int vs float at the start of the next session.",
        theory: "CLT",
        theoryDetail:
          "Cognitive Load Theory: reduce extraneous load by chunking type-conversion content.",
        triggerPattern:
          "Cluster of 'too fast' and 'typecasting unclear' negative feedbacks.",
      },
      {
        id: "rec-off-2",
        cue: "Add 2 short casting drills to the next lab.",
        theory: "RBT",
        theoryDetail:
          "Strengthen the Apply level called out in ILO-1 with targeted practice.",
        triggerPattern: "Multiple requests for more practice exercises.",
      },
    ],
  },
  "session-control": {
    sessionId: "session-control",
    mode: "offline",
    totalFeedback: 12,
    pedagogicalCount: 11,
    aspectDist: [
      { label: "Content", value: 5 },
      { label: "Practice", value: 3 },
      { label: "Delivery", value: 2 },
      { label: "Other", value: 3 },
    ],
    issueDist: [
      { label: "Nested loops confusing", value: 2 },
      { label: "Loop choice unclear", value: 1 },
      { label: "Workload too heavy", value: 1 },
      { label: "Need trace exercises", value: 1 },
    ],
    polarityDist: [
      { label: "Negative", value: 6 },
      { label: "Neutral", value: 3 },
      { label: "Positive", value: 6 },
    ],
    gaps: [
      {
        iloId: "ilo-4",
        expected:
          "Evaluate the correctness of loops by tracing variable state across iterations.",
        actual: "Students request explicit trace exercises before evaluating loops.",
        severity: "medium",
      },
    ],
    recommendations: [
      {
        id: "rec-off-3",
        cue: "Provide a structured trace table template for nested loops.",
        theory: "CLT",
        theoryDetail:
          "External scaffolds reduce working-memory load during iteration tracing.",
        triggerPattern:
          "Repeated 'nested loops confusing' + trace-exercise requests.",
      },
    ],
  },
};

/** Simulated analysis call. Replace with real API call in production. */
export async function runAnalysis(
  sessionId: string,
  mode: AnalysisMode,
): Promise<AnalysisResult> {
  // Simulate processing latency.
  await new Promise((resolve) => setTimeout(resolve, mode === "online" ? 2500 : 1800));
  const bank = mode === "online" ? ONLINE_RESULTS : OFFLINE_RESULTS;
  const result = bank[sessionId];
  if (!result) {
    throw new Error(`No mock analysis available for session ${sessionId}`);
  }
  return result;
}
