import { useCallback, useMemo, useRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { FeedbackOpenPanel, type FeedbackOpenState } from "./FeedbackOpenPanel";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution, isUncategorized } from "./interpretDistribution";
import { DistributionEmptyState } from "./DistributionEmptyState";
import { computeDynamicYAxisWidth } from "./labelWidth";
import type { DistEntry } from "@/lib/types/types";
import { CHART_COLORS, ASPECT_COLOR_ORDER } from "@/lib/constants/chartColors";

interface AspectDistChartProps {
  data: DistEntry[];
  totalFeedback: number;
  className?: string;
  height?: number;
  onSelectCategory?: (entry: DistEntry) => void;
  opening?: FeedbackOpenState | null;
  onCancelOpen?: () => void;
  onRetryOpen?: () => void;
}

const aspectColorMap = Object.fromEntries(ASPECT_COLOR_ORDER);

export function AspectDistChart({
  data,
  totalFeedback,
  className,
  height,
  onSelectCategory,
  opening,
  onCancelOpen,
  onRetryOpen,
}: AspectDistChartProps) {
  const categorizedData = useMemo(
    () => data.filter((entry) => !isUncategorized(entry.label)),
    [data],
  );
  const uncategorizedCount = data.find((entry) => isUncategorized(entry.label))?.value ?? 0;
  const interpretation = interpretDistribution(categorizedData, {
    kind: "aspect",
    totalFeedback,
    uncategorizedCount,
  });
  const isEmpty = categorizedData.length === 0;
  // Fit the axis to the longest label so bars reach the chart edge.
  const yAxisWidth = useMemo(
    () => computeDynamicYAxisWidth(categorizedData.map((d) => d.label)),
    [categorizedData],
  );
  // Ref avoids re-rendering the chart on every tooltip coordinate change.
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const handleCoordinate = useCallback((c: { x: number; y: number } | null) => {
    if (!c) return;
    const prev = anchorRef.current;
    if (prev && prev.x === c.x && prev.y === c.y) return;
    anchorRef.current = { x: c.x, y: c.y };
  }, []);
  const panelOpen = opening != null && opening.status !== "idle";

  return (
    <AnalysisCard className={className}>
      <CardHeader>
        <CardTitle className="text-base">Aspect distribution</CardTitle>
        <CardDescription>
          What students talked about across {totalFeedback} responses.
        </CardDescription>
        <InterpretationBlock text={interpretation} />
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <DistributionEmptyState
            title="No aspects to display"
            description={
              uncategorizedCount > 0
                ? "All responses were Uncategorized, so no aspect pattern could be shown."
                : "No feedback was available for this distribution."
            }
          />
        ) : (
          <div
            className="relative"
            style={{ height: height ?? Math.max(220, categorizedData.length * 32) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categorizedData}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, "dataMax"]}
                  allowDecimals={false}
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  width={yAxisWidth}
                  tickMargin={6}
                  interval={0}
                />
                {!panelOpen && (
                  <Tooltip
                    {...chartTooltipProps}
                    content={
                      <ChartTooltipContent
                        colorMap={aspectColorMap}
                        dist={categorizedData}
                        onCoordinateChange={handleCoordinate}
                        onSelect={(item) => {
                          const entry = categorizedData.find((d) => d.label === item.label);
                          if (entry) onSelectCategory?.(entry);
                        }}
                      />
                    }
                  />
                )}
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categorizedData.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={aspectColorMap[entry.label] || CHART_COLORS[0]}
                      onClick={() => onSelectCategory?.(entry)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {panelOpen && (
              <FeedbackOpenPanel
                status={opening.status}
                error={opening.status === "error" ? opening.error : undefined}
                anchor={anchorRef.current}
                onCancel={onCancelOpen ?? (() => {})}
                onRetry={onRetryOpen}
              />
            )}
          </div>
        )}
      </CardContent>
    </AnalysisCard>
  );
}
