import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderGradients } from "../../components/faculty/charts/utils/gradients";
import {
  areaGradient,
  divergingGradient,
  polarityTrendGradient,
} from "../../components/faculty/charts/utils/gradientSpecs";

describe("renderGradients", () => {
  it("emits literal defs/linearGradient elements with the requested ids", () => {
    const markup = renderToStaticMarkup(
      renderGradients([
        areaGradient("grad-submission", "var(--color-chart-1)"),
        divergingGradient(
          "grad-polarity",
          "var(--color-chart-1)",
          "var(--color-chart-3)",
          "var(--color-chart-4)",
        ),
        areaGradient("grad-polarity-pos", "var(--color-chart-1)"),
        areaGradient("grad-polarity-neg", "var(--color-chart-4)"),
      ]),
    );

    expect(markup).toContain("<defs>");
    expect(markup).toContain('id="grad-submission"');
    expect(markup).toContain('id="grad-polarity"');
    expect(markup).toContain('id="grad-polarity-pos"');
    expect(markup).toContain('id="grad-polarity-neg"');
    expect(markup).toContain('stop-color="var(--color-chart-1)"');
    expect(markup).toContain('stop-color="var(--color-chart-4)"');
  });

  it("forwards userSpaceOnUse coordinates onto the linearGradient", () => {
    const markup = renderToStaticMarkup(
      renderGradients([polarityTrendGradient({ y: 20, height: 240 })]),
    );

    expect(markup).toContain('gradientUnits="userSpaceOnUse"');
    expect(markup).toContain('y1="20"');
    expect(markup).toContain('y2="260"');
  });
});

describe("polarityTrendGradient", () => {
  it("falls back to a bounding-box gradient before the plot is measured", () => {
    const spec = polarityTrendGradient(null);

    expect(spec.id).toBe("grad-polarity");
    expect(spec.gradientUnits).toBeUndefined();
    expect(spec.y1).toBeUndefined();
    expect(spec.y2).toBeUndefined();
    expect(spec.stops.map((s) => s.offset)).toEqual(["0%", "50%", "100%"]);
    expect(spec.stops.map((s) => s.color)).toEqual([
      "var(--color-chart-1)",
      "var(--color-chart-3)",
      "var(--color-chart-4)",
    ]);
  });

  it("aligns green/yellow/red to +1/0/-1 once the plot area is measured", () => {
    const spec = polarityTrendGradient({ y: 20, height: 240 });

    expect(spec.gradientUnits).toBe("userSpaceOnUse");
    expect(spec.y1).toBe(20);
    expect(spec.y2).toBe(260);
    expect(spec.stops.map((s) => s.offset)).toEqual([20, 140, 260]);
    expect(spec.stops.map((s) => s.color)).toEqual([
      "var(--color-chart-1)",
      "var(--color-chart-3)",
      "var(--color-chart-4)",
    ]);
    expect(spec.stops.every((s) => s.stopOpacity === 0.5)).toBe(true);
  });
});
