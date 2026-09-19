const NEUTRAL_BAND = 1 / 3;

/**
 * Color for a polarity value: green above +1/3, yellow inside the neutral
 * band, red below -1/3.
 */
export function getPolarityColor(value: number | undefined): string {
  if (typeof value !== "number") return "var(--color-chart-3)";
  if (value > NEUTRAL_BAND) return "var(--color-chart-1)";
  if (value < -NEUTRAL_BAND) return "var(--color-chart-4)";
  return "var(--color-chart-3)";
}

/** Bucket label for the polarity axis, matching the neutral band. */
export function polarityBucketLabel(value: number): string {
  if (value > NEUTRAL_BAND) return "Positive";
  if (value < -NEUTRAL_BAND) return "Negative";
  return "Neutral";
}
