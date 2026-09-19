import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DistributionEmptyState } from "../../components/faculty/charts/DistributionEmptyState";

describe("DistributionEmptyState", () => {
  it("renders the title and description", () => {
    const markup = renderToStaticMarkup(
      <DistributionEmptyState
        title="No issues to display"
        description="All responses were Uncategorized, so no pedagogical issue could be shown."
      />,
    );

    expect(markup).toContain("No issues to display");
    expect(markup).toContain(
      "All responses were Uncategorized, so no pedagogical issue could be shown.",
    );
  });
});
