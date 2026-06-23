export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

export const SPECIAL_COLORS: Record<string, string> = {
  "Uncategorized": "var(--color-muted-foreground)",
};

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
