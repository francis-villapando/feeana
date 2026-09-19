export interface GradientStop {
  /** Percentage for objectBoundingBox gradients, or SVG user units for userSpaceOnUse. */
  offset: string | number;
  color: string;
  stopOpacity: number;
}

export interface GradientSpec {
  id: string;
  stops: GradientStop[];
  /** SVG gradientUnits; defaults to objectBoundingBox. */
  gradientUnits?: "userSpaceOnUse";
  /** Gradient start/end Y in SVG user units (required with userSpaceOnUse). */
  y1?: number;
  y2?: number;
}

/** Bounds of the chart plot area in SVG user units (pixels). */
export interface PlotArea {
  y: number;
  height: number;
}

/** Vertical gradient fading a solid color from 0.8 opacity to 0.05. */
export function areaGradient(
  id: string,
  color: string,
  fromOpacity = 0.8,
  toOpacity = 0.05,
): GradientSpec {
  return {
    id,
    stops: [
      { offset: "5%", color, stopOpacity: fromOpacity },
      { offset: "95%", color, stopOpacity: toOpacity },
    ],
  };
}

/** Diverging gradient for polarity: positive (top) → neutral (mid) → negative (bottom). */
export function divergingGradient(
  id: string,
  positiveColor: string,
  neutralColor: string,
  negativeColor: string,
): GradientSpec {
  return {
    id,
    stops: [
      { offset: "0%", color: positiveColor, stopOpacity: 0.8 },
      { offset: "50%", color: neutralColor, stopOpacity: 0.4 },
      { offset: "100%", color: negativeColor, stopOpacity: 0.8 },
    ],
  };
}

/**
 * Diverging gradient for polarity, value-aligned to the plot area: green at
 * +1 (top), yellow at 0 (mid), red at -1 (bottom). Falls back to a
 * bounding-box gradient until the plot area has been measured.
 */
export function polarityTrendGradient(plot: PlotArea | null): GradientSpec {
  const top = plot?.y;
  const mid = plot ? plot.y + plot.height / 2 : undefined;
  const bottom = plot ? plot.y + plot.height : undefined;
  return {
    id: "grad-polarity",
    gradientUnits: plot ? "userSpaceOnUse" : undefined,
    y1: top,
    y2: bottom,
    stops: [
      { offset: top ?? "0%", color: "var(--color-chart-1)", stopOpacity: 0.5 },
      { offset: mid ?? "50%", color: "var(--color-chart-3)", stopOpacity: 0.5 },
      { offset: bottom ?? "100%", color: "var(--color-chart-4)", stopOpacity: 0.5 },
    ],
  };
}

/**
 * Diverging gradient for the polarity line stroke, value-aligned to the plot
 * area like `polarityTrendGradient` but at full opacity so the 2.5px stroke
 * stays readable. Falls back to a bounding-box gradient until measured.
 */
export function polarityLineGradient(plot: PlotArea | null): GradientSpec {
  const top = plot?.y;
  const mid = plot ? plot.y + plot.height / 2 : undefined;
  const bottom = plot ? plot.y + plot.height : undefined;
  return {
    id: "grad-polarity-line",
    gradientUnits: plot ? "userSpaceOnUse" : undefined,
    y1: top,
    y2: bottom,
    stops: [
      { offset: top ?? "0%", color: "var(--color-chart-1)", stopOpacity: 1 },
      { offset: mid ?? "50%", color: "var(--color-chart-3)", stopOpacity: 1 },
      { offset: bottom ?? "100%", color: "var(--color-chart-4)", stopOpacity: 1 },
    ],
  };
}
