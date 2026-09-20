export interface LabelWidthOptions {
  fontSize?: number;
  fontFamily?: string;
}

export interface YAxisWidthOptions extends LabelWidthOptions {
  tickMargin?: number;
  maxWidth?: number;
}

const FALLBACK_PAD = 12;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  try {
    return document.createElement("canvas").getContext("2d");
  } catch {
    return null;
  }
}

/** Measure a label's pixel width at the 11px tick font. */
export function measureLabelWidth(text: string, options: LabelWidthOptions = {}): number {
  const { fontSize = 11, fontFamily } = options;
  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = `${fontSize}px ${fontFamily ?? "sans-serif"}`;
    return Math.ceil(ctx.measureText(text).width);
  }
  // SSR/tests have no canvas; approximate with a char-count heuristic.
  return Math.ceil(text.length * fontSize * 0.6) + FALLBACK_PAD;
}

/** Axis width that keeps the longest label flush against the chart edge. */
export function computeDynamicYAxisWidth(
  labels: string[],
  options: YAxisWidthOptions = {},
): number {
  const { fontSize = 11, tickMargin = 6, fontFamily, maxWidth = 260 } = options;
  if (labels.length === 0) return 0;
  const longest = labels.reduce((best, label) => (label.length > best.length ? label : best), "");
  const measured = measureLabelWidth(longest, { fontSize, fontFamily });
  return Math.min(maxWidth, Math.ceil(measured) + tickMargin + 6);
}
