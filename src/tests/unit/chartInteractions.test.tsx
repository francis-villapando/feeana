import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  measureLabelWidth,
  computeDynamicYAxisWidth,
} from "../../components/faculty/charts/labelWidth";
import { resolveRbtSectorIndex } from "../../components/faculty/charts/rbtGeometry";
import { RbtDistChart } from "../../components/faculty/charts/RbtDistChart";
import { AspectDistChart } from "../../components/faculty/charts/AspectDistChart";
import { IssueDistChart } from "../../components/faculty/charts/IssueDistChart";
import type { DistEntry } from "../../lib/types/types";

describe("labelWidth utilities", () => {
  it("computes dynamic YAxis width correctly for empty or given labels", () => {
    expect(computeDynamicYAxisWidth([])).toBe(0);
    const width = computeDynamicYAxisWidth(["Positive Climate", "Regard for Student Perspectives"]);
    expect(width).toBeGreaterThan(50);
    expect(width).toBeLessThanOrEqual(260);
  });

  it("measureLabelWidth returns positive pixel width", () => {
    const w = measureLabelWidth("Instructional Learning Formats");
    expect(w).toBeGreaterThan(0);
  });
});

describe("RBT Radar sector resolution", () => {
  const center = { x: 150, y: 150 };

  it("resolves top (12 o'clock) to index 0 (Remember)", () => {
    const cursor = { x: 150, y: 50 };
    expect(resolveRbtSectorIndex(cursor, center)).toBe(0);
  });

  it("resolves top-right (2 o'clock) to index 1 (Understand)", () => {
    const cursor = { x: 236, y: 100 };
    expect(resolveRbtSectorIndex(cursor, center)).toBe(1);
  });

  it("resolves bottom-right (4 o'clock) to index 2 (Apply)", () => {
    const cursor = { x: 236, y: 200 };
    expect(resolveRbtSectorIndex(cursor, center)).toBe(2);
  });

  it("resolves bottom (6 o'clock) to index 3 (Analyze)", () => {
    const cursor = { x: 150, y: 250 };
    expect(resolveRbtSectorIndex(cursor, center)).toBe(3);
  });

  it("resolves bottom-left (8 o'clock) to index 4 (Evaluate)", () => {
    const cursor = { x: 64, y: 200 };
    expect(resolveRbtSectorIndex(cursor, center)).toBe(4);
  });

  it("resolves top-left (10 o'clock) to index 5 (Create)", () => {
    const cursor = { x: 64, y: 100 };
    expect(resolveRbtSectorIndex(cursor, center)).toBe(5);
  });
});

describe("Chart SSR rendering", () => {
  const sampleRbt: DistEntry[] = [
    { label: "Remember", value: 0, feedbackTexts: [] },
    { label: "Understand", value: 5, feedbackTexts: ["text 1", "text 2"] },
    { label: "Apply", value: 0, feedbackTexts: [] },
    { label: "Analyze", value: 3, feedbackTexts: ["text 3"] },
    { label: "Evaluate", value: 0, feedbackTexts: [] },
    { label: "Create", value: 0, feedbackTexts: [] },
  ];

  it("renders RbtDistChart without crashing", () => {
    const html = renderToStaticMarkup(<RbtDistChart data={sampleRbt} />);
    expect(html).toContain("RBT distribution");
    expect(html).toContain("Cognitive-process level distribution.");
  });

  it("renders AspectDistChart without crashing", () => {
    const html = renderToStaticMarkup(
      <AspectDistChart data={[{ label: "Positive Climate", value: 4 }]} totalFeedback={4} />,
    );
    expect(html).toContain("Aspect distribution");
  });

  it("renders IssueDistChart without crashing", () => {
    const html = renderToStaticMarkup(
      <IssueDistChart data={[{ label: "procedural bottleneck", value: 2 }]} />,
    );
    expect(html).toContain("Issue distribution");
  });
});
