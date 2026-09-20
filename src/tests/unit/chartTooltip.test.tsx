import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartTooltipContent } from "../../components/analysis/ChartTooltip";
import type { DistEntry } from "../../lib/types/types";

function entry(label: string, value: number, feedbackTexts?: string[]): DistEntry {
  return { label, value, feedbackTexts };
}

describe("ChartTooltipContent", () => {
  it("resolves the label from the row payload instead of the series dataKey", () => {
    const markup = renderToStaticMarkup(
      <ChartTooltipContent
        active
        payload={[
          {
            dataKey: "value",
            value: 5,
            color: "var(--color-chart-1)",
            payload: entry("Remember (1)", 5, ["Recall the definition."]),
          },
        ]}
        colorMap={{ "Remember (1)": "var(--color-chart-1)" }}
        dist={[entry("Remember (1)", 5, ["Recall the definition."])]}
      />,
    );

    expect(markup).toContain("Remember (1)");
    expect(markup).toContain("color:var(--color-chart-1)");
    expect(markup).not.toContain("Value");
  });

  it("falls back to the dataKey when the row payload has no label", () => {
    const markup = renderToStaticMarkup(
      <ChartTooltipContent
        active
        payload={[
          {
            dataKey: "Intrinsic",
            value: 7,
            color: "var(--color-chart-3)",
            payload: { group: "Cognitive load", Intrinsic: 7, Extraneous: 1 },
          },
        ]}
        dist={[entry("Intrinsic", 7)]}
      />,
    );

    expect(markup).toContain("Intrinsic");
    expect(markup).toContain("Count: 7");
  });

  it("resolves the label from the radar point's name when the payload has no label", () => {
    const markup = renderToStaticMarkup(
      <ChartTooltipContent
        active
        payload={[
          {
            dataKey: "value",
            value: 5,
            color: "var(--color-chart-5)",
            payload: { name: "Remember", value: 5, payload: entry("Remember", 5) },
          },
        ]}
        colorMap={{ Remember: "var(--color-chart-5)" }}
        dist={[entry("Remember", 5)]}
      />,
    );

    expect(markup).toContain("Remember");
    expect(markup).not.toContain("Value");
  });

  it("does not render the click-to-view hint", () => {
    const markup = renderToStaticMarkup(
      <ChartTooltipContent
        active
        payload={[
          {
            dataKey: "value",
            value: 5,
            color: "var(--color-chart-1)",
            payload: entry("Remember (1)", 5),
          },
        ]}
        dist={[entry("Remember (1)", 5)]}
        onSelect={() => {}}
      />,
    );

    expect(markup).not.toContain("Click to view feedback");
  });
});
