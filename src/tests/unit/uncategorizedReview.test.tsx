import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NAMED_ISSUES, ISSUE_RULES } from "../../lib/algorithm/rules";
import { buildDiagnosticRecord } from "../../lib/algorithm/pedagogicalDiagnosticMapping";
import { computeAnalysisResult } from "../../lib/algorithm/pipeline";
import {
  uncategorizedReviewPrompt,
  UncategorizedReviewList,
} from "../../components/analysis/UncategorizedReviewModal";
import type { DiagnosticRecord, FeedbackInput, SessionContext } from "../../lib/algorithm/types";

const sessionContext: SessionContext = {
  course: "CS 101",
  topic: "Recursion",
  targetIloRbt: 3,
  sessionId: "s1",
  iloStatement: "Understand recursion principles",
};

const feedbackStream: FeedbackInput[] = [
  { id: "f1", rawText: "The pacing was too fast." },
  { id: "f2", rawText: "We moved too quickly through the examples." },
  { id: "f3", rawText: "I could not keep up with the lecture." },
  { id: "f4", rawText: "Completely unrelated remark." },
];

const targetIloRbt = sessionContext.targetIloRbt;

function buildBuffer(uncategorizedIssue: string): DiagnosticRecord[] {
  return [
    buildDiagnosticRecord("Lesson Pace", "neg", targetIloRbt, "f1"),
    buildDiagnosticRecord("Lesson Pace", "neg", targetIloRbt, "f2"),
    buildDiagnosticRecord("Lesson Pace", "neg", targetIloRbt, "f3"),
    buildDiagnosticRecord(uncategorizedIssue, "neu", targetIloRbt, "f4"),
  ];
}

describe("NAMED_ISSUES", () => {
  it("lists the 14 canonical named tags and excludes the Uncategorized fallback", () => {
    expect(NAMED_ISSUES).toHaveLength(14);
    expect(NAMED_ISSUES).not.toContain("Uncategorized");
    expect(new Set(NAMED_ISSUES).size).toBe(14);
    expect(new Set(NAMED_ISSUES)).toEqual(
      new Set(Object.values(ISSUE_RULES).filter((label) => label !== "Uncategorized")),
    );
  });
});

describe("computeAnalysisResult reclassification", () => {
  it("counts an Uncategorized response separately before review", () => {
    const result = computeAnalysisResult({
      sessionId: "s1",
      feedbackStream,
      buffer: buildBuffer("Uncategorized"),
      sessionContext,
      activeIlos: [],
    });

    expect(result.totalFeedback).toBe(4);
    expect(result.issueDist.find((e) => e.label === "Uncategorized")?.value).toBe(1);
    expect(result.issueDist.find((e) => e.label === "Lesson Pace")?.value).toBe(3);
  });

  it("moves a manually classified response out of Uncategorized without changing totals", () => {
    const before = computeAnalysisResult({
      sessionId: "s1",
      feedbackStream,
      buffer: buildBuffer("Uncategorized"),
      sessionContext,
      activeIlos: [],
    });
    const after = computeAnalysisResult({
      sessionId: "s1",
      feedbackStream,
      buffer: buildBuffer("Unclear Lessons"),
      sessionContext,
      activeIlos: [],
    });

    expect(after.totalFeedback).toBe(before.totalFeedback);
    expect(after.issueDist.find((e) => e.label === "Uncategorized")).toBeUndefined();
    expect(after.issueDist.find((e) => e.label === "Unclear Lessons")?.value).toBe(1);
    expect(after.issueDist.find((e) => e.label === "Lesson Pace")?.value).toBe(3);
  });
});

describe("uncategorizedReviewPrompt", () => {
  it("frames the listed responses as the reviewer's own", () => {
    const prompt = uncategorizedReviewPrompt(3);
    expect(prompt).toContain("3 response(s)");
    expect(prompt).toContain("could not be automatically classified");
    expect(prompt).toContain("listed for your review");
  });
});

describe("UncategorizedReviewList", () => {
  it("quotes each response and offers the review actions", () => {
    const markup = renderToStaticMarkup(
      <UncategorizedReviewList
        items={[
          { feedbackId: "f4", rawText: "Completely unrelated remark." },
          { feedbackId: "f5", rawText: "Another odd comment." },
        ]}
        onSubmit={() => {}}
        onSkip={() => {}}
      />,
    );

    expect(markup).toContain("Completely unrelated remark.");
    expect(markup).toContain("Another odd comment.");
    expect(markup.match(/Assign a pedagogical issue/g)).toHaveLength(2);
    expect(markup).toContain("Skip");
    expect(markup).toContain("Apply to analysis");
  });

  it("blocks Apply until at least one issue is assigned", () => {
    const markup = renderToStaticMarkup(
      <UncategorizedReviewList
        items={[{ feedbackId: "f4", rawText: "Completely unrelated remark." }]}
        onSubmit={() => {}}
        onSkip={() => {}}
      />,
    );

    const applyButton = markup.match(/<button[^>]*>Apply to analysis<\/button>/)?.[0];
    expect(applyButton).toContain('disabled=""');
    expect(markup.match(/<button[^>]*>Skip<\/button>/)?.[0]).not.toContain('disabled=""');
  });
});
