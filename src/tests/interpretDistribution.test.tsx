import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { interpretDistribution } from "../components/faculty/charts/interpretDistribution";
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

    expect(markup).toContain("Analyze (Level 4)");
    expect(markup).toContain("Level 3");
    expect(markup).not.toContain("[object Object]");
  });
});
