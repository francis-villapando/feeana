import type { DistEntry } from "@/lib/types/types";

type ChartKind = "aspect" | "polarity" | "issue" | "rbt" | "clt";

interface InterpretationContext {
  kind: ChartKind;
  totalFeedback: number;
}

const RBT_LEVEL_NUMBER: Record<string, number> = {
  Remember: 1,
  Understand: 2,
  Apply: 3,
  Analyze: 4,
  Evaluate: 5,
  Create: 6,
};

function formatPercent(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function enumerateLabels(labels: string[]): string {
  if (labels.length === 1) return `**${labels[0]}**`;
  if (labels.length === 2) return `**${labels[0]}** and **${labels[1]}**`;
  return labels.map((label, index) => index === labels.length - 1 ? `and **${label}**` : `**${label}**`).join(", ");
}

function interpretAspectOrIssue(data: DistEntry[], totalFeedback: number, kind: "aspect" | "issue"): string {
  if (data.length === 0) return "No data available for interpretation.";

  const topicNoun = kind === "aspect" ? "discussed" : "raised concerns about";

  // Most prominent category
  const categorizedEntries = data.filter((entry) => entry.label !== "Uncategorized");
  const maxCount = Math.max(...categorizedEntries.map((entry) => entry.value));
  const topEntries = categorizedEntries.filter((entry) => entry.value === maxCount);
  const topLabels = topEntries.map((entry) => entry.label);
  const firstSentence = maxCount === 0
    ? `No prominent ${kind} pattern was identified across the ${totalFeedback} responses.`
    : `Students most frequently ${topicNoun} ${enumerateLabels(topLabels)} (${maxCount} ${maxCount === 1 ? "mention" : "mentions"}, ${formatPercent(maxCount, totalFeedback)} of responses).`;

  // Missing categories (excluding Uncategorized)
  const missingLabels = categorizedEntries
    .filter((entry) => entry.value === 0)
    .map((entry) => entry.label);
  const secondSentence = missingLabels.length === 0
    ? ""
    : ` No feedback was received about ${enumerateLabels(missingLabels)}, which may indicate limited student engagement with ${missingLabels.length === 1 ? "that area" : "those areas"}.`;

  // Uncategorized
  const uncategorizedEntry = data.find((entry) => entry.label === "Uncategorized");
  const uncategorizedCount = uncategorizedEntry?.value ?? 0;
  const thirdSentence = uncategorizedCount > 0
    ? ` ${uncategorizedCount} ${uncategorizedCount === 1 ? "response" : "responses"} (${formatPercent(uncategorizedCount, totalFeedback)}) could not be mapped to an ${kind}, limiting the analysis.`
    : "";

  return `${firstSentence}${secondSentence}${thirdSentence}`;
}

function interpretPolarity(data: DistEntry[], totalFeedback: number): string {
  if (data.length === 0) return "No data available for interpretation.";

  const maxCount = Math.max(...data.map((entry) => entry.value));
  const topEntries = data.filter((entry) => entry.value === maxCount);
  const topLabels = topEntries.map((entry) => entry.label);

  const negativeEntry = data.find((entry) => entry.label === "Negative");
  const negativeCount = negativeEntry?.value ?? 0;
  const negativePercent = Math.round((negativeCount / totalFeedback) * 100);

  // Tied labels
  if (topEntries.length > 1) {
    const hasNegativeTie = topLabels.includes("Negative");
    const suffix = hasNegativeTie
      ? " \u2014 students raised concerns worth reviewing."
      : ".";
    return `Feedback was tied between ${enumerateLabels(topLabels)} (${maxCount} ${maxCount === 1 ? "mention" : "mentions"} each, ${formatPercent(maxCount, totalFeedback)} of responses)${suffix}`;
  }

  // Negative is prominent (single)
  if (topLabels[0] === "Negative") {
    return `The majority of feedback was **Negative** (${maxCount} ${maxCount === 1 ? "mention" : "mentions"}, ${formatPercent(maxCount, totalFeedback)} of responses) \u2014 students raised concerns worth reviewing.`;
  }

  // Positive/Neutral is prominent (single)
  const firstSentence = `The majority of feedback was **${topLabels[0]}** (${maxCount} ${maxCount === 1 ? "mention" : "mentions"}, ${formatPercent(maxCount, totalFeedback)} of responses).`;

  const secondSentence = negativePercent > 30
    ? ` However, ${negativeCount} responses (${negativePercent}%) were negative \u2014 students raised significant concerns worth reviewing.`
    : "";

  return `${firstSentence}${secondSentence}`;
}

function interpretRbt(data: DistEntry[], totalFeedback: number): string {
  if (data.length === 0) return "No data available for interpretation.";

  // Most prominent level
  const categorizedEntries = data.filter((entry) => entry.label !== "Uncategorized");
  const maxCount = Math.max(...categorizedEntries.map((entry) => entry.value));
  const topEntries = categorizedEntries.filter((entry) => entry.value === maxCount);
  const topLabels = topEntries.map((entry) => entry.label);
  const levelNumbers = topLabels.map((label) => RBT_LEVEL_NUMBER[label] ?? "?");
  const levelInfo = topLabels.map((label, index) => `**${label}** (Level ${levelNumbers[index]})`).join(" and ");

  const firstSentence = maxCount === 0
    ? "No prominent cognitive-process pattern was identified."
    : `Student feedback primarily reflects ${levelInfo} (${maxCount} ${maxCount === 1 ? "mention" : "mentions"}, ${formatPercent(maxCount, totalFeedback)} of responses).`;

  // Other non-zero, non-uncategorized levels
  const otherLevels = categorizedEntries
    .filter((entry) => entry.value > 0 && entry.value < maxCount)
    .sort((a, b) => (RBT_LEVEL_NUMBER[a.label] ?? 0) - (RBT_LEVEL_NUMBER[b.label] ?? 0));
  const secondSentence = otherLevels.length === 0
    ? ""
    : ` Other levels present: ${otherLevels.map((entry) => `**${entry.label}** (Level ${RBT_LEVEL_NUMBER[entry.label] ?? "?"})`).join(", ")}.`;

  // Uncategorized
  const uncategorizedEntry = data.find((entry) => entry.label === "Uncategorized");
  const uncategorizedCount = uncategorizedEntry?.value ?? 0;
  const thirdSentence = uncategorizedCount > 0
    ? ` ${uncategorizedCount} response${uncategorizedCount === 1 ? "" : "s"} (${formatPercent(uncategorizedCount, totalFeedback)}) could not be mapped to a Bloom\u2019s level, limiting the analysis.`
    : "";

  return `${firstSentence}${secondSentence}${thirdSentence}`;
}

function interpretClt(data: DistEntry[], totalFeedback: number): string {
  if (data.length === 0) return "No data available for interpretation.";

  const categorizedEntries = data.filter((entry) => entry.label !== "Uncategorized");
  const maxCount = Math.max(...categorizedEntries.map((entry) => entry.value));
  const topEntries = categorizedEntries.filter((entry) => entry.value === maxCount);
  const topLabels = topEntries.map((entry) => entry.label);

  const allTied = categorizedEntries.length > 1 && categorizedEntries.every((entry) => entry.value === categorizedEntries[0].value);

  // More prominent type
  let firstSentence: string;
  if (maxCount === 0) {
    firstSentence = "No prominent cognitive-load pattern was identified.";
  } else if (allTied) {
    firstSentence = `Feedback indicates **Intrinsic** and **Extraneous** load are equally prominent (${maxCount} ${maxCount === 1 ? "mention" : "mentions"} each, ${formatPercent(maxCount, totalFeedback)} of responses).`;
  } else {
    firstSentence = `Feedback indicates **${topLabels[0]}** load is the primary cognitive burden (${maxCount} ${maxCount === 1 ? "mention" : "mentions"}, ${formatPercent(maxCount, totalFeedback)} of responses).`;
  }

  // Suggestion
  let suggestion: string;
  if (allTied) {
    suggestion = "This suggests the topic may be inherently difficult for students and that students may have faced unnecessary distractions or unclear materials.";
  } else if (topLabels[0] === "Extraneous") {
    suggestion = "This suggests students faced unnecessary distractions or unclear materials.";
  } else if (topLabels[0] === "Intrinsic") {
    suggestion = "This suggests the topic may be inherently difficult for students.";
  } else {
    suggestion = "";
  }
  const secondSentence = suggestion ? ` ${suggestion}` : "";

  // Uncategorized
  const uncategorizedEntry = data.find((entry) => entry.label === "Uncategorized");
  const uncategorizedCount = uncategorizedEntry?.value ?? 0;
  const thirdSentence = uncategorizedCount > 0
    ? ` ${uncategorizedCount} response${uncategorizedCount === 1 ? "" : "s"} (${formatPercent(uncategorizedCount, totalFeedback)}) could not be mapped to a cognitive-load type, limiting the analysis.`
    : "";

  return `${firstSentence}${secondSentence}${thirdSentence}`;
}

export function interpretDistribution(data: DistEntry[], context: InterpretationContext): string {
  switch (context.kind) {
    case "aspect":
      return interpretAspectOrIssue(data, context.totalFeedback, "aspect");
    case "issue":
      return interpretAspectOrIssue(data, context.totalFeedback, "issue");
    case "polarity":
      return interpretPolarity(data, context.totalFeedback);
    case "rbt":
      return interpretRbt(data, context.totalFeedback);
    case "clt":
      return interpretClt(data, context.totalFeedback);
  }
}
