import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { interpretDistribution } from "../../components/faculty/charts/interpretDistribution";
import type { DistEntry } from "@/lib/types/types";

describe("interpretDistribution RBT rendering", () => {
  it("renders RBT labels correctly without object coercion", () => {
    const data: DistEntry[] = [
      { label: "Analyze", value: 3 },
      { label: "Apply", value: 1 },
      { label: "Uncategorized", value: 0 },
    ];

    const markup = renderToStaticMarkup(
      <>{interpretDistribution(data, { kind: "rbt", totalFeedback: 4 })}</>,
    );

    expect(markup).toContain("Analyze (4)");
    expect(markup).toContain("(3)");
    expect(markup).not.toContain("[object Object]");
  });
});

describe("interpretDistribution all-uncategorized", () => {
  const cases: { kind: "aspect" | "issue" | "rbt" | "clt"; expected: string }[] = [
    { kind: "aspect", expected: "no dominant aspect could be identified" },
    { kind: "issue", expected: "no specific pedagogical issue could be extracted" },
    { kind: "rbt", expected: "no cognitive-process (RBT) pattern could be derived" },
    { kind: "clt", expected: "no cognitive-load (CLT) pattern could be derived" },
  ];

  for (const { kind, expected } of cases) {
    it(`renders the all-uncategorized message for ${kind}`, () => {
      const markup = renderToStaticMarkup(
        <>{interpretDistribution([], { kind, totalFeedback: 5, uncategorizedCount: 5 })}</>,
      );

      expect(markup).toContain("All 5 responses were");
      expect(markup).toContain(expected);
      expect(markup).not.toContain("No data available for interpretation.");
    });
  }

  it("keeps the no-data message when there is truly no feedback", () => {
    const markup = renderToStaticMarkup(
      <>{interpretDistribution([], { kind: "issue", totalFeedback: 0 })}</>,
    );

    expect(markup).toContain("No data available for interpretation.");
  });

  it("still interprets mixed data normally when some responses are categorized", () => {
    const data: DistEntry[] = [
      { label: "Clarity Deficit", value: 3 },
      { label: "Uncategorized", value: 2 },
    ];

    const markup = renderToStaticMarkup(
      <>
        {interpretDistribution(data, { kind: "issue", totalFeedback: 5, uncategorizedCount: 2 })}
      </>,
    );

    expect(markup).toContain("Students most frequently raised concerns about");
    expect(markup).not.toContain("All 5 responses were");
  });
});
