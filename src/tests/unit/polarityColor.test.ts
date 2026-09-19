import { describe, expect, it } from "vitest";
import {
  getPolarityColor,
  polarityBucketLabel,
} from "../../components/faculty/charts/utils/polarityColor";

describe("getPolarityColor", () => {
  it("returns green for values above the neutral band", () => {
    expect(getPolarityColor(0.4)).toBe("var(--color-chart-1)");
    expect(getPolarityColor(0.34)).toBe("var(--color-chart-1)");
    expect(getPolarityColor(1)).toBe("var(--color-chart-1)");
  });

  it("returns yellow inside the neutral band", () => {
    expect(getPolarityColor(0)).toBe("var(--color-chart-3)");
    expect(getPolarityColor(0.2)).toBe("var(--color-chart-3)");
    expect(getPolarityColor(0.33)).toBe("var(--color-chart-3)");
    expect(getPolarityColor(-0.33)).toBe("var(--color-chart-3)");
  });

  it("returns red for values below the neutral band", () => {
    expect(getPolarityColor(-0.93)).toBe("var(--color-chart-4)");
    expect(getPolarityColor(-0.34)).toBe("var(--color-chart-4)");
    expect(getPolarityColor(-1)).toBe("var(--color-chart-4)");
  });

  it("falls back to neutral for non-numbers", () => {
    expect(getPolarityColor(undefined)).toBe("var(--color-chart-3)");
  });
});

describe("polarityBucketLabel", () => {
  it("labels values above the neutral band as Positive", () => {
    expect(polarityBucketLabel(1)).toBe("Positive");
    expect(polarityBucketLabel(0.5)).toBe("Positive");
  });

  it("labels values inside the neutral band as Neutral", () => {
    expect(polarityBucketLabel(0)).toBe("Neutral");
    expect(polarityBucketLabel(0.33)).toBe("Neutral");
    expect(polarityBucketLabel(-0.33)).toBe("Neutral");
  });

  it("labels values below the neutral band as Negative", () => {
    expect(polarityBucketLabel(-1)).toBe("Negative");
    expect(polarityBucketLabel(-0.5)).toBe("Negative");
  });
});
