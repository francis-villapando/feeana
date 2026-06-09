/*
 * Module 5: Strategy Generation.
 * This file will compute distributions and generate recommendations or warnings.
 */

import { ISSUE_DESCRIPTIONS, ISSUE_RECOMMENDATIONS, RBT_DESCRIPTIONS, RBT_LEVELS, TTI_DESCRIPTIONS } from "./rules";
import type {
  BufferedDiagnostic,
  DiagnosticRecord,
  StrategyStats,
  RecommendationItem,
  WarningItem,
  SessionContext,
} from "./types";

export function CalculateDistributions(
  buffer: DiagnosticRecord[],
  totalFeedback: number,
): StrategyStats {
  console.debug("[strategyGeneration] Calculating distributions", {
    totalFeedback,
    diagnosticCount: buffer.length,
  });

  const stats: StrategyStats = {
    totalFeedback,
    issueCounts: {},
    gapCount: 0,
    aspectCounts: {},
    polarityCounts: { pos: 0, neu: 0, neg: 0 },
  };

  for (const diag of buffer) {
    stats.issueCounts[diag.issue] = (stats.issueCounts[diag.issue] || 0) + 1;
    if (diag.isGap) stats.gapCount++;
    stats.aspectCounts[diag.tti] = (stats.aspectCounts[diag.tti] || 0) + 1;

    if (diag.polarity === "pos" || diag.polarity === "neu" || diag.polarity === "neg") {
      stats.polarityCounts[diag.polarity]++;
    }
  }

  return stats;
}

export function GeneratePedagogicalCue(
  sessionContext: SessionContext,
  uniqueIssue: BufferedDiagnostic,
  totalFeedback: number
): RecommendationItem {
  console.debug("[strategyGeneration] Generating pedagogical cue", {
    topic: sessionContext.topic,
    isGap: uniqueIssue.isGap,
    issue: uniqueIssue.issue,
  });

  const percentage = Math.round((uniqueIssue.count / totalFeedback) * 100);
  const percentageStr = `${percentage}%`;
  const rbtName = RBT_LEVELS[uniqueIssue.rbt] ?? String(uniqueIssue.rbt);

  const rbtLower = rbtName.toLowerCase();
  const cltLower = uniqueIssue.clt.toLowerCase();
  const ttiLower = uniqueIssue.tti.toLowerCase();
  const recommendationSentence = ISSUE_RECOMMENDATIONS[uniqueIssue.issue] ?? `Thus, "recommendation cue for ${uniqueIssue.issue}."`;

  const paragraph = uniqueIssue.isGap
    ? `A total of ${percentageStr} of the class is experiencing ${uniqueIssue.issue} under ${ttiLower} in ${sessionContext.topic}. According to RBT, students are not achieving the ${rbtLower} level and hence they are not able to achieve the goal: ${sessionContext.iloStatement}. CLT identifies high ${cltLower} load as the cause. ${recommendationSentence}`
    : `A total of ${percentageStr} of the class is experiencing ${uniqueIssue.issue} under ${ttiLower} in ${sessionContext.topic}. According to RBT, students are not achieving the ${rbtLower} level. CLT identifies high ${cltLower} load as the cause. ${recommendationSentence}`;

  const terms = [
    {
      text: percentageStr,
      kind: "metric",
      detail: `${uniqueIssue.count} out of ${totalFeedback} responses`,
    },
    {
      text: uniqueIssue.issue,
      kind: "issue",
      detail: ISSUE_DESCRIPTIONS[uniqueIssue.issue] ?? uniqueIssue.issue,
    },
    {
      text: sessionContext.topic,
      kind: "topic",
      detail: `The session topic.`,
    },
    {
      text: rbtName,
      kind: "RBT",
      detail: RBT_DESCRIPTIONS[rbtName] ?? rbtName,
    },
    {
      text: uniqueIssue.tti,
      kind: "TTI",
      detail: TTI_DESCRIPTIONS[uniqueIssue.tti] ?? uniqueIssue.tti,
    },
    ...(uniqueIssue.isGap
      ? [
        {
          text: sessionContext.iloStatement,
          kind: "ILO" as const,
          detail: sessionContext.iloStatement,
        },
      ]
      : []),
    {
      text: uniqueIssue.clt,
      kind: "CLT",
      detail: uniqueIssue.clt === "Intrinsic"
        ? "The inherent complexity of a task."
        : "The way in which instruction has been designed.",
    },
    {
      text: recommendationSentence,
      kind: "recommendation",
      detail: `Recommended pedagogical intervention for ${uniqueIssue.issue}.`,
    },
  ];

  return {
    id: `rec-${Math.random().toString(36).slice(2, 10)}`,
    issue: uniqueIssue.issue,
    paragraph,
    terms,
    priority: uniqueIssue.count,
    theories: ["RBT", "CLT"],
    isGap: uniqueIssue.isGap,
  };
}

export function GenerateDiagnosticWarning(
  uniqueIssue: BufferedDiagnostic,
): WarningItem {
  console.debug("[strategyGeneration] Generating diagnostic warning", {
    issue: uniqueIssue.issue,
  });

  return {
    id: `warn-${Math.random().toString(36).slice(2, 10)}`,
    issue: uniqueIssue.issue,
    warning: `Minor issue detected: ${uniqueIssue.issue}`,
    count: uniqueIssue.count,
  };
}

/*
 * ISSUE TAG
 * Relational Coldness - Feedback indicating a lack of emotional connection, rapport, or mutual respect between the instructor and students.
 * Classroom Tension - The presence of frustration, irritability, or anger expressed in student-teacher or peer-to-peer interactions.
 * Evaluation Unfairness - Perceptions that the instructor is unresponsive to individual needs or that grading and responsivity are biased.
 * Perceived Marginalization - Feedback suggesting that student ideas, leadership, or autonomy are being ignored or undervalued.
 * Subject Alienation - A lack of perceived relevance in the lesson content, leading to student disengagement from the topic.
 * Peer Distraction - Breakdowns in behavior management where the actions of other students disrupt the focus of the session.
 * Instructional Cadence - Issues related to the flow of the lesson, such as a pace that is too fast or inefficient transitions between topics.
 * Clarity Deficit - Feedback indicating that the learning objectives are not clearly defined or that the presentation format is not engaging or fundamentally unclear.
 * Abstract Logic Gap - Difficulty in breaking down complex concepts into parts or examining the relationships between different logical components.
 * Procedural Bottleneck - Struggles with executing algorithms or applying learned procedures to solve specific programming problems.
 * Conceptual Misalignment - A failure to explain ideas in the students' own words or a fundamental misunderstanding of key disciplinary concepts.
 * Design Synthesis Failure - Challenges in assembling learned elements to produce new or original work, such as formulated code structures.
 * Feedback Latency - Concerns regarding the speed or quality of instructional scaffolding provided during the learning process.
 * Notation Struggle - Difficulties related to the specialized symbols, syntax, and formal language unique to the computer science discipline.
 * 
 * RBT LEVEL (displayed in bullet form, "---" represents subsequent bullets)
 * remember - Recognizing: identifying --- Recalling/retrieving
 * understand - Interpreting: clarifying/paraphrasing/translating/representing --- Exemplifying: illustrating/instantiating --- Classifying: categorizing/subsuming --- Summarizing: abstracting/generalizing --- Inferring: concluding/extrapolating/interpolating/predicting --- Comparing: contrasting/mapping/matching --- Explaining
 * apply - Executing: carrying out --- Implementing: using
 * analyze - Differentiating: distinguishing/discriminating/focusing/selecting --- Organizing: finding/coherence/integrating/outlining/structuring --- Attributing: deconstructing
 * evaluate - Checking: monitoring/testing --- Critiquing: judging
 * create - Generating: hypothesizing --- Planning: designing --- Producing: constructing
 * 
 * ASPECT (to be added in paragraph template)
 * positive climate - Reflects the overall emotional tone of the classroom and the connection between teachers and students.
 * negaive climate - Reflects overall level of expressed negativity in the classroom between teachers and students (e.g., anger, aggression, irritability).
 * teacher sensitivity - Encompasses teachers’ responsivity to students’ needs and awareness of students’ level of academic and emotional functioning.
 * regard for student perspectives - The degree to which the teacher’s interactions with students and classroom activities place an emphasis on students’ interests, motivations, and points of view, rather than being very teacher driven.
 * behavior management - Encompasses teachers’ ability to use effective methods to prevent and redirect misbehavior by presenting clear behavioral expectations and minimizing time spent on behavioral issues.
 * productivity - Considers how well teachers manage instructional time and routines so that students have the maximum number of opportunities to learn.
 * instructional learning formats - The degree to which teachers maximize students’ engagement and ability to learn by providing interesting activities, instruction, centers, and materials.
 * concept development - The degree to which instructional discussions and activities promote students’ higher-order thinking skills versus focus on rote and fact-based learning.
 * quality of feedback - Considers teachers’ provision of feedback focused on expanding learning and understanding (formative evaluation), not correctness or the end product (summative evaluation).
 * language modeling - The quality and amount of teachers’ use of language-stimulation and language-facilitation techniques during individual, small-group, and large-group interactions with children.
*/