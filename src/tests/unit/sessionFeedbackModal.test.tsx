import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  filterFeedbackByCategory,
  filterFeedbackByQuery,
  SessionFeedbackList,
} from "../../components/analysis/SessionFeedbackModal";
import type { Feedback } from "../../lib/types/types";
import type { DiagnosticRecord } from "../../lib/algorithm/types";

function makeFeedback(id: string, rawText: string, cleanedText = rawText): Feedback {
  return {
    id,
    sessionId: "s1",
    rawText,
    cleanedText,
    aspects: [],
    createdAt: "2026-01-01T00:00:00Z",
  };
}

const feedback = [
  makeFeedback("f1", "The pacing was too fast."),
  makeFeedback("f2", "Great examples in class."),
  makeFeedback("f3", "More practice problems please."),
];

describe("filterFeedbackByCategory", () => {
  it("returns only feedback whose raw text is in the category texts", () => {
    const result = filterFeedbackByCategory(feedback, {
      title: "Instructional Cadence",
      feedbackTexts: ["The pacing was too fast.", "More practice problems please."],
    });
    expect(result.map((f) => f.id)).toEqual(["f1", "f3"]);
  });

  it("returns an empty list when the filter has no texts", () => {
    expect(filterFeedbackByCategory(feedback, { title: "X" })).toEqual([]);
  });

  it("returns an empty list when the filter has an empty texts array", () => {
    expect(filterFeedbackByCategory(feedback, { title: "X", feedbackTexts: [] })).toEqual([]);
  });

  it("returns an empty list when no filter is provided", () => {
    expect(filterFeedbackByCategory(feedback, null)).toEqual([]);
  });
});

describe("filterFeedbackByQuery", () => {
  it("matches case-insensitively on raw text", () => {
    const result = filterFeedbackByQuery(feedback, "PACING");
    expect(result.map((f) => f.id)).toEqual(["f1"]);
  });

  it("matches on cleaned text", () => {
    const fb = [makeFeedback("f1", "raw", "cleaned phrase")];
    expect(filterFeedbackByQuery(fb, "cleaned").map((f) => f.id)).toEqual(["f1"]);
  });

  it("returns the full list for an empty query", () => {
    expect(filterFeedbackByQuery(feedback, "  ")).toHaveLength(3);
  });
});

describe("SessionFeedbackList", () => {
  it("renders only category feedback with toggle counts when a filter is set", () => {
    const markup = renderToStaticMarkup(
      <SessionFeedbackList
        sessionFeedback={feedback}
        categoryFilter={{
          title: "Instructional Cadence",
          feedbackTexts: ["The pacing was too fast."],
        }}
      />,
    );
    expect(markup).toContain("The pacing was too fast.");
    expect(markup).not.toContain("Great examples in class.");
    expect(markup).toContain("Selected Category (1)");
    expect(markup).toContain("All Feedback (3)");
    expect(markup).toContain("Instructional Cadence");
  });

  it("renders all feedback when no filter is set", () => {
    const markup = renderToStaticMarkup(<SessionFeedbackList sessionFeedback={feedback} />);
    expect(markup).toContain("The pacing was too fast.");
    expect(markup).toContain("Great examples in class.");
    expect(markup).toContain("More practice problems please.");
    expect(markup).toContain("All Feedback (3)");
  });

  it("shows an empty state when the category has no matching feedback", () => {
    const markup = renderToStaticMarkup(
      <SessionFeedbackList
        sessionFeedback={feedback}
        categoryFilter={{ title: "Unknown", feedbackTexts: ["no match"] }}
      />,
    );
    expect(markup).toContain("No feedback matches this category");
  });

  it("renders mapping pills in order and omits the submission date", () => {
    const diagnostics = new Map<string, DiagnosticRecord>([
      [
        "f1",
        {
          tti: "Instructional Learning Formats",
          rbt: 3,
          clt: "Extraneous",
          issue: "Clarity Deficit",
          polarity: "neg",
          isGap: false,
          feedbackId: "f1",
        },
      ],
    ]);
    const markup = renderToStaticMarkup(
      <SessionFeedbackList sessionFeedback={feedback} diagnosticsByFeedbackId={diagnostics} />,
    );
    expect(markup).toContain("Instructional Learning Formats");
    expect(markup).toContain("Clarity Deficit");
    expect(markup).toContain("Negative");
    expect(markup).toContain("Apply");
    expect(markup).toContain("Extraneous");
    expect(markup).not.toContain("2026-01-01");
  });

  it("skips rbt/clt pills for uncategorized feedback", () => {
    const diagnostics = new Map<string, DiagnosticRecord>([
      [
        "f1",
        {
          tti: "Uncategorized",
          rbt: 0,
          clt: "Intrinsic",
          issue: "Uncategorized",
          polarity: "neu",
          isGap: false,
          feedbackId: "f1",
        },
      ],
    ]);
    const markup = renderToStaticMarkup(
      <SessionFeedbackList sessionFeedback={feedback} diagnosticsByFeedbackId={diagnostics} />,
    );
    expect(markup).toContain("Uncategorized");
    expect(markup).not.toContain("Intrinsic");
  });

  it("renders only the polarity pill for Positive/Neutral category filters", () => {
    const diagnostics = new Map<string, DiagnosticRecord>([
      [
        "f1",
        {
          tti: "Uncategorized",
          rbt: 0,
          clt: "Intrinsic",
          issue: "Uncategorized",
          polarity: "pos",
          isGap: false,
          feedbackId: "f1",
        },
      ],
    ]);
    const markup = renderToStaticMarkup(
      <SessionFeedbackList
        sessionFeedback={feedback}
        categoryFilter={{ title: "Positive", feedbackTexts: ["The pacing was too fast."] }}
        diagnosticsByFeedbackId={diagnostics}
      />,
    );
    expect(markup).toContain("Positive");
    expect(markup).not.toContain("Uncategorized");
  });
});
