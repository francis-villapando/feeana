/*
 * Static pedagogical taxonomy rules stored as TypeScript constants.
 * This file is intentionally kept as TS constants for MVP simplicity.
 */

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

export const RBT_LEVEL_NAMES = ["", "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as const;

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
