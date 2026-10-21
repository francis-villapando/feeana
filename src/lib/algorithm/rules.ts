// Pedagogical rule tables shared by Modules 4-6

import type { CltCategory } from "./types";

export const RULES_VERSION = "1.6";

export const ISSUE_RULES: Record<string, string> = {
  "relational coldness": "Distant Teacher",
  "classroom tension": "Classroom Tension",
  "evaluation unfairness": "Unfair Treatment",
  "perceived marginalization": "Feeling Ignored",
  "subject alienation": "Irrelevant Topic",
  "peer distraction": "Classmate Distraction",
  "instructional cadence": "Lesson Pace",
  "clarity deficit": "Unclear Lessons",
  "abstract logic gap": "Breaking Down Ideas",
  "procedural bottleneck": "Using Learned Steps",
  "conceptual misalignment": "Concept Confusion",
  "design synthesis failure": "Creating Own Work",
  "feedback latency": "Slow or Poor Feedback",
  "notation struggle": "Symbols and Syntax",
  "distant teacher": "Distant Teacher",
  "unfair treatment": "Unfair Treatment",
  "feeling ignored": "Feeling Ignored",
  "irrelevant topic": "Irrelevant Topic",
  "classmate distraction": "Classmate Distraction",
  "lesson pace": "Lesson Pace",
  "unclear lessons": "Unclear Lessons",
  "breaking down ideas": "Breaking Down Ideas",
  "using learned steps": "Using Learned Steps",
  "concept confusion": "Concept Confusion",
  "creating own work": "Creating Own Work",
  "slow or poor feedback": "Slow or Poor Feedback",
  "symbols and syntax": "Symbols and Syntax",
  uncategorized: "Uncategorized",
};

/** Resolves any raw model key or legacy display name to the current issue tag. */
export function resolveIssueLabel(issue: string): string {
  return ISSUE_RULES[issue.toLowerCase()] ?? issue;
}

/** The 14 named issue tags in canonical display form, excluding the Uncategorized fallback. */
export const NAMED_ISSUES: string[] = Array.from(new Set(Object.values(ISSUE_RULES))).filter(
  (label) => label !== "Uncategorized",
);

export const TTI_RULES: Record<string, string> = {
  "relational coldness": "Positive Climate",
  "distant teacher": "Positive Climate",
  "classroom tension": "Negative Climate",
  "evaluation unfairness": "Teacher Sensitivity",
  "unfair treatment": "Teacher Sensitivity",
  "perceived marginalization": "Regard for Student Perspectives",
  "feeling ignored": "Regard for Student Perspectives",
  "subject alienation": "Regard for Student Perspectives",
  "irrelevant topic": "Regard for Student Perspectives",
  "peer distraction": "Behavior Management",
  "classmate distraction": "Behavior Management",
  "instructional cadence": "Productivity",
  "lesson pace": "Productivity",
  "clarity deficit": "Instructional Learning Formats",
  "unclear lessons": "Instructional Learning Formats",
  "abstract logic gap": "Concept Development",
  "breaking down ideas": "Concept Development",
  "procedural bottleneck": "Concept Development",
  "using learned steps": "Concept Development",
  "conceptual misalignment": "Concept Development",
  "concept confusion": "Concept Development",
  "design synthesis failure": "Concept Development",
  "creating own work": "Concept Development",
  "feedback latency": "Quality of Feedback",
  "slow or poor feedback": "Quality of Feedback",
  "notation struggle": "Language Modeling",
  "symbols and syntax": "Language Modeling",
  uncategorized: "Uncategorized",
};

export const RBT_RULES: Record<string, number> = {
  "relational coldness": 1,
  "distant teacher": 1,
  "classroom tension": 1,
  "evaluation unfairness": 5,
  "unfair treatment": 5,
  "perceived marginalization": 1,
  "feeling ignored": 1,
  "subject alienation": 1,
  "irrelevant topic": 1,
  "peer distraction": 1,
  "classmate distraction": 1,
  "instructional cadence": 2,
  "lesson pace": 2,
  "clarity deficit": 2,
  "unclear lessons": 2,
  "abstract logic gap": 4,
  "breaking down ideas": 4,
  "procedural bottleneck": 3,
  "using learned steps": 3,
  "conceptual misalignment": 2,
  "concept confusion": 2,
  "design synthesis failure": 6,
  "creating own work": 6,
  "feedback latency": 2,
  "slow or poor feedback": 2,
  "notation struggle": 1,
  "symbols and syntax": 1,
  uncategorized: 1,
};

export const CLT_RULES: Record<string, CltCategory> = {
  "relational coldness": "Extraneous",
  "distant teacher": "Extraneous",
  "classroom tension": "Extraneous",
  "evaluation unfairness": "Extraneous",
  "unfair treatment": "Extraneous",
  "perceived marginalization": "Extraneous",
  "feeling ignored": "Extraneous",
  "subject alienation": "Extraneous",
  "irrelevant topic": "Extraneous",
  "peer distraction": "Extraneous",
  "classmate distraction": "Extraneous",
  "instructional cadence": "Extraneous",
  "lesson pace": "Extraneous",
  "clarity deficit": "Extraneous",
  "unclear lessons": "Extraneous",
  "abstract logic gap": "Intrinsic",
  "breaking down ideas": "Intrinsic",
  "procedural bottleneck": "Intrinsic",
  "using learned steps": "Intrinsic",
  "conceptual misalignment": "Intrinsic",
  "concept confusion": "Intrinsic",
  "design synthesis failure": "Intrinsic",
  "creating own work": "Intrinsic",
  "feedback latency": "Extraneous",
  "slow or poor feedback": "Extraneous",
  "notation struggle": "Intrinsic",
  "symbols and syntax": "Intrinsic",
  uncategorized: "Extraneous",
};

const BASE_RECOMMENDATIONS: Record<string, string> = {
  "relational coldness":
    "It is recommended to set up places where students can talk and connect, such as open forums, to start the lesson with a short icebreaker, and to use friendly, positive words so the class feels welcome.",
  "classroom tension":
    "It is recommended to calm the class by giving reminders about behavior or stopping aggressive exchanges, and to use polite, calm words to ease students’ frustration.",
  "evaluation unfairness":
    "It is recommended to share all grading criteria and rubrics before a task starts, so expectations are clear and grading is seen as fair.",
  "perceived marginalization":
    "It is recommended to let students help lead the class, such as with student-led discussion questions and forums, so they have more say and their different views are valued.",
  "subject alienation":
    "It is recommended to start with a short overview of the lesson and use real-life examples to link new topics to what students already know.",
  "peer distraction":
    "It is recommended to set clear class rules and apply them consistently, and to use interesting activities, light humor, and relatable questions to bring students’ attention back to their studies.",
  "instructional cadence":
    "It is recommended to keep a steady lesson routine and have a second plan for switching between topics, to avoid wasted time and match the pace to how fast students can follow.",
  "clarity deficit":
    "It is recommended to put related materials in one place and use visual cues, such as colored highlights or arrows, to point students to the main learning goals.",
  "abstract logic gap":
    "It is recommended to teach hard ideas a little at a time, using step-by-step support that helps students move from basic understanding to deeper analysis.",
  "procedural bottleneck":
    "It is recommended to give a complete worked example with every step shown, so students can study and copy it before solving the problem on their own.",
  "conceptual misalignment":
    "It is recommended to give half-finished problems that students must complete, so they can check their understanding and match it with the key concepts.",
  "design synthesis failure":
    "It is recommended to slowly reduce the help you give, step by step, so students build the understanding they need to create original designs on their own.",
  "feedback latency":
    "It is recommended to give quick, specific feedback that responds to what the student did, to keep students working and to make sure the guidance still fits what they are learning.",
  "notation struggle":
    "It is recommended to use different fonts, colors or shading to highlight the important syntax and symbols.",
  uncategorized: "There is no intervention needed for uncategorized issues in feedback.",
};

export const ISSUE_RECOMMENDATIONS: Record<string, string> = {
  ...BASE_RECOMMENDATIONS,
  "distant teacher": BASE_RECOMMENDATIONS["relational coldness"],
  "Distant Teacher": BASE_RECOMMENDATIONS["relational coldness"],
  "Classroom Tension": BASE_RECOMMENDATIONS["classroom tension"],
  "unfair treatment": BASE_RECOMMENDATIONS["evaluation unfairness"],
  "Unfair Treatment": BASE_RECOMMENDATIONS["evaluation unfairness"],
  "feeling ignored": BASE_RECOMMENDATIONS["perceived marginalization"],
  "Feeling Ignored": BASE_RECOMMENDATIONS["perceived marginalization"],
  "irrelevant topic": BASE_RECOMMENDATIONS["subject alienation"],
  "Irrelevant Topic": BASE_RECOMMENDATIONS["subject alienation"],
  "classmate distraction": BASE_RECOMMENDATIONS["peer distraction"],
  "Classmate Distraction": BASE_RECOMMENDATIONS["peer distraction"],
  "lesson pace": BASE_RECOMMENDATIONS["instructional cadence"],
  "Lesson Pace": BASE_RECOMMENDATIONS["instructional cadence"],
  "unclear lessons": BASE_RECOMMENDATIONS["clarity deficit"],
  "Unclear Lessons": BASE_RECOMMENDATIONS["clarity deficit"],
  "breaking down ideas": BASE_RECOMMENDATIONS["abstract logic gap"],
  "Breaking Down Ideas": BASE_RECOMMENDATIONS["abstract logic gap"],
  "using learned steps": BASE_RECOMMENDATIONS["procedural bottleneck"],
  "Using Learned Steps": BASE_RECOMMENDATIONS["procedural bottleneck"],
  "concept confusion": BASE_RECOMMENDATIONS["conceptual misalignment"],
  "Concept Confusion": BASE_RECOMMENDATIONS["conceptual misalignment"],
  "creating own work": BASE_RECOMMENDATIONS["design synthesis failure"],
  "Creating Own Work": BASE_RECOMMENDATIONS["design synthesis failure"],
  "slow or poor feedback": BASE_RECOMMENDATIONS["feedback latency"],
  "Slow or Poor Feedback": BASE_RECOMMENDATIONS["feedback latency"],
  "symbols and syntax": BASE_RECOMMENDATIONS["notation struggle"],
  "Symbols and Syntax": BASE_RECOMMENDATIONS["notation struggle"],
};

export const RBT_LEVELS = [
  "",
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
] as const;

export const RBT_LEVEL_NUMBERS = Object.fromEntries(
  (RBT_LEVELS as readonly string[]).slice(1).map((name, index) => [name, index + 1]),
) as Record<string, number>;

const BASE_DESCRIPTIONS: Record<string, string> = {
  "relational coldness":
    "Students feel the teacher does not connect with them. They see little warmth or respect between the teacher and the class.",
  "classroom tension":
    "Students show frustration, irritation or anger in how they deal with the teacher or with each other.",
  "evaluation unfairness":
    "Students feel the teacher does not respond to individual needs, or that grading and responses are biased.",
  "perceived marginalization":
    "Students feel their ideas, leadership or choices are ignored or not valued.",
  "subject alienation":
    "Students do not see why the lesson matters to them, so they lose interest in the topic.",
  "peer distraction":
    "Classmates’ behavior disrupts the class and breaks the focus of the session because behavior is not well managed.",
  "instructional cadence":
    "The flow of the lesson has problems, such as a pace that is too fast or poor switching between topics.",
  "clarity deficit":
    "Students say the lesson goals are not clear, or the way the lesson is presented is not interesting or is very confusing.",
  "abstract logic gap":
    "Students struggle to split a hard concept into smaller parts or to see how the parts relate to each other.",
  "procedural bottleneck":
    "Students struggle to carry out an algorithm or to use learned steps to solve a specific programming problem.",
  "conceptual misalignment":
    "Students cannot explain ideas in their own words, or they badly misunderstand the key concepts of the subject.",
  "design synthesis failure":
    "Students struggle to put what they learned together to make something new or original, such as their own code structure.",
  "feedback latency":
    "Students feel the help or guidance they get while learning is too slow or not good enough.",
  "notation struggle":
    "Students struggle with the special symbols, syntax and formal language used in computer science.",
  uncategorized: "Feedback that does not match any known pedagogical issue pattern.",
};

export const ISSUE_DESCRIPTIONS: Record<string, string> = {
  ...BASE_DESCRIPTIONS,
  "distant teacher": BASE_DESCRIPTIONS["relational coldness"],
  "Distant Teacher": BASE_DESCRIPTIONS["relational coldness"],
  "Classroom Tension": BASE_DESCRIPTIONS["classroom tension"],
  "unfair treatment": BASE_DESCRIPTIONS["evaluation unfairness"],
  "Unfair Treatment": BASE_DESCRIPTIONS["evaluation unfairness"],
  "feeling ignored": BASE_DESCRIPTIONS["perceived marginalization"],
  "Feeling Ignored": BASE_DESCRIPTIONS["perceived marginalization"],
  "irrelevant topic": BASE_DESCRIPTIONS["subject alienation"],
  "Irrelevant Topic": BASE_DESCRIPTIONS["subject alienation"],
  "classmate distraction": BASE_DESCRIPTIONS["peer distraction"],
  "Classmate Distraction": BASE_DESCRIPTIONS["peer distraction"],
  "lesson pace": BASE_DESCRIPTIONS["instructional cadence"],
  "Lesson Pace": BASE_DESCRIPTIONS["instructional cadence"],
  "unclear lessons": BASE_DESCRIPTIONS["clarity deficit"],
  "Unclear Lessons": BASE_DESCRIPTIONS["clarity deficit"],
  "breaking down ideas": BASE_DESCRIPTIONS["abstract logic gap"],
  "Breaking Down Ideas": BASE_DESCRIPTIONS["abstract logic gap"],
  "using learned steps": BASE_DESCRIPTIONS["procedural bottleneck"],
  "Using Learned Steps": BASE_DESCRIPTIONS["procedural bottleneck"],
  "concept confusion": BASE_DESCRIPTIONS["conceptual misalignment"],
  "Concept Confusion": BASE_DESCRIPTIONS["conceptual misalignment"],
  "creating own work": BASE_DESCRIPTIONS["design synthesis failure"],
  "Creating Own Work": BASE_DESCRIPTIONS["design synthesis failure"],
  "slow or poor feedback": BASE_DESCRIPTIONS["feedback latency"],
  "Slow or Poor Feedback": BASE_DESCRIPTIONS["feedback latency"],
  "symbols and syntax": BASE_DESCRIPTIONS["notation struggle"],
  "Symbols and Syntax": BASE_DESCRIPTIONS["notation struggle"],
};

export const RBT_DESCRIPTIONS: Record<string, string> = {
  Remember: "Recognizing: identifying --- Recalling, retrieving",
  Understand:
    "Interpreting: clarifying, paraphrasing, translating, representing --- Exemplifying: illustrating, instantiating --- Classifying: categorizing, subsuming --- Summarizing: abstracting, generalizing --- Inferring: concluding, extrapolating, interpolating, predicting --- Comparing: contrasting, mapping, matching --- Explaining",
  Apply: "Executing: carrying out --- Implementing: using",
  Analyze:
    "Differentiating: distinguishing, discriminating, focusing, selecting --- Organizing: finding, coherence, integrating, outlining, structuring --- Attributing: deconstructing",
  Evaluate: "Checking: monitoring, testing --- Critiquing: judging",
  Create: "Generating: hypothesizing --- Planning: designing --- Producing: constructing",
};

export const TTI_DESCRIPTIONS: Record<string, string> = {
  "Positive Climate":
    "Reflects the overall emotional tone of the classroom and the connection between teachers and students.",
  "Negative Climate":
    "Reflects overall level of expressed negativity in the classroom between teachers and students (e.g., anger, aggression, irritability).",
  "Teacher Sensitivity":
    "Encompasses teachers' responsivity to students' needs and awareness of students' level of academic and emotional functioning.",
  "Regard for Student Perspectives":
    "The degree to which the teacher's interactions with students and classroom activities place an emphasis on students' interests, motivations, and points of view, rather than being very teacher driven.",
  "Behavior Management":
    "Encompasses teachers' ability to use effective methods to prevent and redirect misbehavior by presenting clear behavioral expectations and minimizing time spent on behavioral issues.",
  Productivity:
    "Considers how well teachers manage instructional time and routines so that students have the maximum number of opportunities to learn.",
  "Instructional Learning Formats":
    "The degree to which teachers maximize students' engagement and ability to learn by providing interesting activities, instruction, centers, and materials.",
  "Concept Development":
    "The degree to which instructional discussions and activities promote students' higher-order thinking skills versus focus on rote and fact-based learning.",
  "Quality of Feedback":
    "Considers teachers' provision of feedback focused on expanding learning and understanding (formative evaluation), not correctness or the end product (summative evaluation).",
  "Language Modeling":
    "The quality and amount of teachers' use of language-stimulation and language-facilitation techniques during individual, small-group, and large-group interactions with children.",
};

export const CLT_DESCRIPTIONS: Record<
  CltCategory,
  { definition: string; suggestion: string; label: string }
> = {
  Intrinsic: {
    definition: "The inherent complexity of a task.",
    suggestion: "This suggests the topic may be inherently difficult for students.",
    label: "conceptual/content difficulty",
  },
  Extraneous: {
    definition: "The way in which instruction has been designed.",
    suggestion: "This suggests students faced unnecessary distractions or unclear materials.",
    label: "instructional delivery/procedural friction",
  },
};
