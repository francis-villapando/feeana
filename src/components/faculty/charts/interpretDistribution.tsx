import { Fragment, type ReactNode } from "react";
import type { DistEntry } from "@/lib/types/types";
import { RBT_LEVEL_NUMBERS } from "@/lib/constants/chartColors";
import { AccentLabel } from "./AccentLabel";

type ChartKind = "aspect" | "polarity" | "issue" | "rbt" | "clt";

interface InterpretationContext {
  kind: ChartKind;
  totalFeedback: number;
}

function formatPercent(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function enumerateLabels(labels: string[]): ReactNode {
  if (labels.length === 1) return <AccentLabel>{labels[0]}</AccentLabel>;
  if (labels.length === 2) return <><AccentLabel>{labels[0]}</AccentLabel> and <AccentLabel>{labels[1]}</AccentLabel></>;
  return labels.map((label, i) => {
    if (i === labels.length - 1) return <Fragment key={label}><span>, and </span><AccentLabel>{label}</AccentLabel></Fragment>;
    if (i === labels.length - 2) return <Fragment key={label}><AccentLabel>{label}</AccentLabel></Fragment>;
    return <Fragment key={label}><AccentLabel>{label}</AccentLabel><span>, </span></Fragment>;
  });
}

function interpretAspectOrIssue(data: DistEntry[], totalFeedback: number, kind: "aspect" | "issue"): ReactNode {
  if (data.length === 0) return "No data available for interpretation.";

  const topicNoun = kind === "aspect" ? "discussed" : "raised concerns about";

  // Most prominent category
  const categorizedEntries = data.filter((entry) => entry.label !== "Uncategorized");
  const maxCount = Math.max(...categorizedEntries.map((entry) => entry.value));
  const topEntries = categorizedEntries.filter((entry) => entry.value === maxCount);
  const topLabels = topEntries.map((entry) => entry.label);
  const firstSentence = maxCount === 0
    ? `No prominent ${kind} pattern was identified across the ${totalFeedback} responses.`
    : <>Students most frequently {topicNoun} {enumerateLabels(topLabels)} ({maxCount} {maxCount === 1 ? "mention" : "mentions"}, {formatPercent(maxCount, totalFeedback)} of responses).</>;

  // Missing categories (excluding Uncategorized)
  const missingLabels = categorizedEntries
    .filter((entry) => entry.value === 0)
    .map((entry) => entry.label);
  const secondSentence = missingLabels.length === 0
    ? ""
    : <> No feedback was received about {enumerateLabels(missingLabels)}, which may indicate limited student engagement with {missingLabels.length === 1 ? "that area" : "those areas"}.</>;

  // Uncategorized
  const uncategorizedEntry = data.find((entry) => entry.label === "Uncategorized");
  const uncategorizedCount = uncategorizedEntry?.value ?? 0;
  const thirdSentence = uncategorizedCount > 0
    ? ` ${uncategorizedCount} ${uncategorizedCount === 1 ? "response" : "responses"} (${formatPercent(uncategorizedCount, totalFeedback)}) could not be mapped to an ${kind}, limiting the analysis.`
    : "";

  return <>{firstSentence}{secondSentence}{thirdSentence}</>;
}

function interpretPolarity(data: DistEntry[], totalFeedback: number): ReactNode {
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
      ? " — students raised concerns worth reviewing."
      : ".";
    return <>Feedback was tied between {enumerateLabels(topLabels)} ({maxCount} {maxCount === 1 ? "mention" : "mentions"} each, {formatPercent(maxCount, totalFeedback)} of responses){suffix}</>;
  }

  // Negative is prominent (single)
  if (topLabels[0] === "Negative") {
    return <>The majority of feedback was <AccentLabel>Negative</AccentLabel> ({maxCount} {maxCount === 1 ? "mention" : "mentions"}, {formatPercent(maxCount, totalFeedback)} of responses) — students raised concerns worth reviewing.</>;
  }

  // Positive/Neutral is prominent (single)
  const firstSentence = <>The majority of feedback was <AccentLabel>{topLabels[0]}</AccentLabel> ({maxCount} {maxCount === 1 ? "mention" : "mentions"}, {formatPercent(maxCount, totalFeedback)} of responses).</>;

  const secondSentence = negativePercent > 30
    ? <> However, {negativeCount} responses ({negativePercent}%) were negative — students raised significant concerns worth reviewing.</>
    : "";

  return <>{firstSentence}{secondSentence}</>;
}

function interpretRbt(data: DistEntry[], totalFeedback: number): ReactNode {
  if (data.length === 0) return "No data available for interpretation.";

  // Most prominent level
  const categorizedEntries = data.filter((entry) => entry.label !== "Uncategorized");
  const maxCount = Math.max(...categorizedEntries.map((entry) => entry.value));
  const topEntries = categorizedEntries.filter((entry) => entry.value === maxCount);
  const topLabels = topEntries.map((entry) => entry.label);
  const levelNumbers = topLabels.map((label) => RBT_LEVEL_NUMBERS[label] ?? "?");
  const levelInfo = topLabels.map((label, index) => <><AccentLabel>{label}</AccentLabel> (Level {levelNumbers[index]})</>);

  const firstSentence = maxCount === 0
    ? "No prominent cognitive-process pattern was identified."
    : <>Student feedback primarily reflects {levelInfo.length === 1 ? levelInfo[0] : <>{levelInfo[0]} and {levelInfo[1]}</>} ({maxCount} {maxCount === 1 ? "mention" : "mentions"}, {formatPercent(maxCount, totalFeedback)} of responses).</>;

  // Other non-zero, non-uncategorized levels
  const otherLevels = categorizedEntries
    .filter((entry) => entry.value > 0 && entry.value < maxCount)
    .sort((a, b) => (RBT_LEVEL_NUMBERS[a.label] ?? 0) - (RBT_LEVEL_NUMBERS[b.label] ?? 0));
  const secondSentence = otherLevels.length === 0
    ? ""
    : <> Other levels present: {otherLevels.map((entry) => <><AccentLabel>{entry.label}</AccentLabel> (Level {RBT_LEVEL_NUMBERS[entry.label] ?? "?"})</>).join(", ")}.</>;

  // Uncategorized
  const uncategorizedEntry = data.find((entry) => entry.label === "Uncategorized");
  const uncategorizedCount = uncategorizedEntry?.value ?? 0;
  const thirdSentence = uncategorizedCount > 0
    ? ` ${uncategorizedCount} response${uncategorizedCount === 1 ? "" : "s"} (${formatPercent(uncategorizedCount, totalFeedback)}) could not be mapped to a Bloom's level, limiting the analysis.`
    : "";

  return <>{firstSentence}{secondSentence}{thirdSentence}</>;
}

function interpretClt(data: DistEntry[], totalFeedback: number): ReactNode {
  if (data.length === 0) return "No data available for interpretation.";

  const categorizedEntries = data.filter((entry) => entry.label !== "Uncategorized");
  const maxCount = Math.max(...categorizedEntries.map((entry) => entry.value));
  const topEntries = categorizedEntries.filter((entry) => entry.value === maxCount);
  const topLabels = topEntries.map((entry) => entry.label);

  const allTied = categorizedEntries.length > 1 && categorizedEntries.every((entry) => entry.value === categorizedEntries[0].value);

  // More prominent type
  let firstSentence: ReactNode;
  if (maxCount === 0) {
    firstSentence = "No prominent cognitive-load pattern was identified.";
  } else if (allTied) {
    firstSentence = <>Feedback indicates <AccentLabel>Intrinsic</AccentLabel> and <AccentLabel>Extraneous</AccentLabel> load are equally prominent ({maxCount} {maxCount === 1 ? "mention" : "mentions"} each, {formatPercent(maxCount, totalFeedback)} of responses).</>;
  } else {
    firstSentence = <>Feedback indicates <AccentLabel>{topLabels[0]}</AccentLabel> load is the primary cognitive burden ({maxCount} {maxCount === 1 ? "mention" : "mentions"}, {formatPercent(maxCount, totalFeedback)} of responses).</>;
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

  return <>{firstSentence}{secondSentence}{thirdSentence}</>;
}

export function interpretDistribution(data: DistEntry[], context: InterpretationContext): ReactNode {
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
