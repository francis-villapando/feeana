export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
  "var(--color-chart-9)",
  "var(--color-chart-10)",
  "var(--color-chart-11)",
  "var(--color-chart-12)",
  "var(--color-chart-13)",
  "var(--color-chart-14)",
];

export const SPECIAL_COLORS: Record<string, string> = {
  Uncategorized: "var(--color-muted-foreground)",
  Unknown: "var(--color-muted-foreground)",
};

export const ASPECT_COLOR_ORDER: [label: string, color: string][] = [
  // Emotional Support
  ["Positive Climate", "var(--color-chart-1)"],
  ["Teacher Sensitivity", "var(--color-chart-2)"],
  ["Regard for Student Perspectives", "var(--color-chart-3)"],
  ["Negative Climate", "var(--color-chart-4)"],
  // Classroom Organization
  ["Instructional Learning Formats", "var(--color-chart-5)"],
  ["Behavior Management", "var(--color-chart-6)"],
  ["Productivity", "var(--color-chart-7)"],
  // Instructional Support
  ["Quality of Feedback", "var(--color-chart-8)"],
  ["Concept Development", "var(--color-chart-9)"],
  ["Language Modeling", "var(--color-chart-10)"],
  ["Uncategorized", "var(--color-muted-foreground)"],
];

export const ISSUE_COLOR_ORDER: [label: string, color: string][] = [
  // Intrinsic — Instructional Support
  ["Notation Struggle", "var(--color-chart-1)"],
  ["Conceptual Misalignment", "var(--color-chart-2)"],
  ["Procedural Bottleneck", "var(--color-chart-3)"],
  ["Abstract Logic Gap", "var(--color-chart-4)"],
  ["Design Synthesis Failure", "var(--color-chart-5)"],
  // Extraneous — Emotional Support
  ["Relational Coldness", "var(--color-chart-6)"],
  ["Evaluation Unfairness", "var(--color-chart-7)"],
  ["Perceived Marginalization", "var(--color-chart-8)"],
  ["Subject Alienation", "var(--color-chart-9)"],
  ["Classroom Tension", "var(--color-chart-10)"],
  // Extraneous — Classroom Organization
  ["Clarity Deficit", "var(--color-chart-11)"],
  ["Peer Distraction", "var(--color-chart-11)"],
  ["Instructional Cadence", "var(--color-chart-12)"],
  // Extraneous — Instructional Support
  ["Feedback Latency", "var(--color-chart-14)"],
  ["Uncategorized", "var(--color-muted-foreground)"],
];

export const POLARITY_COLOR_ORDER: [label: string, color: string][] = [
  ["Positive", "var(--color-chart-1)"],
  ["Neutral", "var(--color-chart-3)"],
  ["Negative", "var(--color-chart-4)"],
];

export const RBT_COLOR_ORDER: [label: string, color: string][] = [
  ["Remember", "var(--color-chart-1)"],
  ["Understand", "var(--color-chart-2)"],
  ["Apply", "var(--color-chart-3)"],
  ["Analyze", "var(--color-chart-4)"],
  ["Evaluate", "var(--color-chart-5)"],
  ["Create", "var(--color-chart-6)"],
  ["Uncategorized", "var(--color-muted-foreground)"],
];

export const CLT_COLOR_ORDER: [label: string, color: string][] = [
  ["Intrinsic", "var(--color-chart-3)"],
  ["Extraneous", "var(--color-chart-4)"],
  ["Uncategorized", "var(--color-muted-foreground)"],
];

export const RBT_LEVEL_NUMBERS: Record<string, number> = {
  Remember: 1,
  Understand: 2,
  Apply: 3,
  Analyze: 4,
  Evaluate: 5,
  Create: 6,
};
