import { CHART_COLORS, SPECIAL_COLORS } from "@/lib/constants/chartColors";
import type { TrendPoint } from "@/lib/hooks/metrics";

export type DistributionDataKey = "aspectDist" | "issueDist" | "rbtDist" | "cltDist";

export type DistributionPoint = Pick<
  TrendPoint,
  "topic" | "aspectDist" | "issueDist" | "rbtDist" | "cltDist"
>;

export interface AggregatedCategories {
  /** Ordered series keys matching the canonical color order; labels outside it sort by global sum, then name. */
  labels: string[];
  colorMap: Record<string, string>;
  /** One row per session: { topic, [label]: count }, zero-filled for absent labels. */
  chartData: Record<string, string | number>[];
}

/**
 * Per-session series for every label present in the data, zero-filled for
 * sessions that lack a label. `alwaysShow` pins the canonical RBT/CLT set.
 * Labels follow the canonical color order; unknown labels sort by global sum,
 * then name.
 */
export function aggregateTopCategories(
  points: DistributionPoint[],
  dataKey: DistributionDataKey,
  knownColorOrder: [label: string, color: string][],
  alwaysShow: string[] = [],
): AggregatedCategories {
  if (points.length === 0) {
    return { labels: [], colorMap: {}, chartData: [] };
  }

  const knownColor = new Map(knownColorOrder);
  const orderIndex = new Map(knownColorOrder.map(([label], i) => [label, i]));

  const globalSums = new Map<string, number>();
  const perPoint = points.map((point) => {
    const counts = new Map<string, number>();
    for (const entry of point[dataKey]) {
      counts.set(entry.label, (counts.get(entry.label) ?? 0) + entry.value);
      globalSums.set(entry.label, (globalSums.get(entry.label) ?? 0) + entry.value);
    }
    return counts;
  });

  const labels = [...new Set([...alwaysShow, ...globalSums.keys()])].sort((a, b) => {
    const byOrder =
      (orderIndex.get(a) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndex.get(b) ?? Number.MAX_SAFE_INTEGER);
    if (byOrder !== 0) return byOrder;
    const bySum = (globalSums.get(b) ?? 0) - (globalSums.get(a) ?? 0);
    if (bySum !== 0) return bySum;
    return a.localeCompare(b);
  });

  const colorMap: Record<string, string> = {};
  let fallbackIndex = 0;
  for (const label of labels) {
    colorMap[label] =
      knownColor.get(label) ??
      SPECIAL_COLORS[label] ??
      CHART_COLORS[fallbackIndex++ % CHART_COLORS.length];
  }

  const chartData = points.map((point, i) => {
    const row: Record<string, string | number> = { topic: point.topic };
    for (const label of labels) {
      row[label] = perPoint[i].get(label) ?? 0;
    }
    return row;
  });

  return { labels, colorMap, chartData };
}
