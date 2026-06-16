import type { CltCategory } from "./types";

export const TTI_RULES: Record<string, string> = {
  "relational coldness": "Positive Climate",
  "classroom tension": "Negative Climate",
  "evaluation unfairness": "Teacher Sensitivity",
  "perceived marginalization": "Regard for Student Perspectives",
  "subject alienation": "Regard for Student Perspectives",
  "peer distraction": "Behavior Management",
  "instructional cadence": "Productivity",
  "clarity deficit": "Instructional Learning Formats",
  "abstract logic gap": "Concept Development",
  "procedural bottleneck": "Concept Development",
  "conceptual misalignment": "Concept Development",
  "design synthesis failure": "Concept Development",
  "feedback latency": "Quality of Feedback",
  "notation struggle": "Language Modeling",
};

export const RBT_RULES: Record<string, number> = {
  "relational coldness": 1,
  "classroom tension": 1,
  "evaluation unfairness": 5,
  "perceived marginalization": 1,
  "subject alienation": 1,
  "peer distraction": 1,
  "instructional cadence": 2,
  "clarity deficit": 5,
  "abstract logic gap": 4,
  "procedural bottleneck": 3,
  "conceptual misalignment": 2,
  "design synthesis failure": 6,
  "feedback latency": 5,
  "notation struggle": 1,
};

export const ISSUE_RULES: Record<string, string> = {
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
};

export const CLT_RULES: Record<string, CltCategory> = {
  "relational coldness": "Extraneous",
  "classroom tension": "Extraneous",
  "evaluation unfairness": "Extraneous",
  "perceived marginalization": "Extraneous",
  "subject alienation": "Extraneous",
  "peer distraction": "Extraneous",
  "instructional cadence": "Extraneous",
  "clarity deficit": "Extraneous",
  "abstract logic gap": "Intrinsic",
  "procedural bottleneck": "Intrinsic",
  "conceptual misalignment": "Intrinsic",
  "design synthesis failure": "Intrinsic",
  "feedback latency": "Extraneous",
  "notation struggle": "Intrinsic",
};

export const ISSUE_RECOMMENDATIONS: Record<string, string> = {
  "relational coldness": `Thus, "recommendation cue for relational coldness."`,
  "classroom tension": `Thus, "recommendation cue for classroom tension."`,
  "evaluation unfairness": `Thus, "recommendation cue for evaluation unfairness."`,
  "perceived marginalization": `Thus, "recommendation cue for perceived marginalization."`,
  "subject alienation": `Thus, "recommendation cue for subject alienation."`,
  "peer distraction": `Thus, "recommendation cue for peer distraction."`,
  "instructional cadence": `Thus, "recommendation cue for instructional cadence."`,
  "clarity deficit": `Thus, "recommendation cue for clarity deficit."`,
  "abstract logic gap": `Thus, "recommendation cue for abstract logic gap."`,
  "procedural bottleneck": `Thus, "recommendation cue for procedural bottleneck."`,
  "conceptual misalignment": `Thus, "recommendation cue for conceptual misalignment."`,
  "design synthesis failure": `Thus, "recommendation cue for design synthesis failure."`,
  "feedback latency": `Thus, "recommendation cue for feedback latency."`,
  "notation struggle": `Thus, "recommendation cue for notation struggle."`,
};

export const RBT_LEVELS = ["", "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as const;

export const ISSUE_DESCRIPTIONS: Record<string, string> = {
  "relational coldness": "Feedback indicating a lack of emotional connection, rapport, or mutual respect between the instructor and students.",
  "classroom tension": "The presence of frustration, irritability, or anger expressed in student-teacher or peer-to-peer interactions.",
  "evaluation unfairness": "Perceptions that the instructor is unresponsive to individual needs or that grading and responsivity are biased.",
  "perceived marginalization": "Feedback suggesting that student ideas, leadership, or autonomy are being ignored or undervalued.",
  "subject alienation": "A lack of perceived relevance in the lesson content, leading to student disengagement from the topic.",
  "peer distraction": "Breakdowns in behavior management where the actions of other students disrupt the focus of the session.",
  "instructional cadence": "Issues related to the flow of the lesson, such as a pace that is too fast or inefficient transitions between topics.",
  "clarity deficit": "Feedback indicating that the learning objectives are not clearly defined or that the presentation format is not engaging or fundamentally unclear.",
  "abstract logic gap": "Difficulty in breaking down complex concepts into parts or examining the relationships between different logical components.",
  "procedural bottleneck": "Struggles with executing algorithms or applying learned procedures to solve specific programming problems.",
  "conceptual misalignment": "A failure to explain ideas in the students' own words or a fundamental misunderstanding of key disciplinary concepts.",
  "design synthesis failure": "Challenges in assembling learned elements to produce new or original work, such as formulated code structures.",
  "feedback latency": "Concerns regarding the speed or quality of instructional scaffolding provided during the learning process.",
  "notation struggle": "Difficulties related to the specialized symbols, syntax, and formal language unique to the computer science discipline.",
};

export const RBT_DESCRIPTIONS: Record<string, string> = {
  "Remember": "Recognizing: identifying --- Recalling/retrieving",
  "Understand": "Interpreting: clarifying/paraphrasing/translating/representing --- Exemplifying: illustrating/instantiating --- Classifying: categorizing/subsuming --- Summarizing: abstracting/generalizing --- Inferring: concluding/extrapolating/interpolating/predicting --- Comparing: contrasting/mapping/matching --- Explaining",
  "Apply": "Executing: carrying out --- Implementing: using",
  "Analyze": "Differentiating: distinguishing/discriminating/focusing/selecting --- Organizing: finding/coherence/integrating/outlining/structuring --- Attributing: deconstructing",
  "Evaluate": "Checking: monitoring/testing --- Critiquing: judging",
  "Create": "Generating: hypothesizing --- Planning: designing --- Producing: constructing",
};

export const TTI_DESCRIPTIONS: Record<string, string> = {
  "Positive Climate": "Reflects the overall emotional tone of the classroom and the connection between teachers and students.",
  "Negative Climate": "Reflects overall level of expressed negativity in the classroom between teachers and students (e.g., anger, aggression, irritability).",
  "Teacher Sensitivity": "Encompasses teachers' responsivity to students' needs and awareness of students' level of academic and emotional functioning.",
  "Regard for Student Perspectives": "The degree to which the teacher's interactions with students and classroom activities place an emphasis on students' interests, motivations, and points of view, rather than being very teacher driven.",
  "Behavior Management": "Encompasses teachers' ability to use effective methods to prevent and redirect misbehavior by presenting clear behavioral expectations and minimizing time spent on behavioral issues.",
  "Productivity": "Considers how well teachers manage instructional time and routines so that students have the maximum number of opportunities to learn.",
  "Instructional Learning Formats": "The degree to which teachers maximize students' engagement and ability to learn by providing interesting activities, instruction, centers, and materials.",
  "Concept Development": "The degree to which instructional discussions and activities promote students' higher-order thinking skills versus focus on rote and fact-based learning.",
  "Quality of Feedback": "Considers teachers' provision of feedback focused on expanding learning and understanding (formative evaluation), not correctness or the end product (summative evaluation).",
  "Language Modeling": "The quality and amount of teachers' use of language-stimulation and language-facilitation techniques during individual, small-group, and large-group interactions with children.",
};
