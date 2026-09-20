import { useCallback, useMemo, useRef } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { FeedbackOpenPanel, type FeedbackOpenState } from "./FeedbackOpenPanel";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution, isUncategorized } from "./interpretDistribution";
import { DistributionEmptyState } from "./DistributionEmptyState";
import type { DistEntry } from "@/lib/types/types";
import { CLT_COLOR_ORDER } from "@/lib/constants/chartColors";

interface CltDistChartProps {
  data: DistEntry[];
  className?: string;
  onSelectCategory?: (entry: DistEntry) => void;
  opening?: FeedbackOpenState | null;
  onCancelOpen?: () => void;
  onRetryOpen?: () => void;
}

const cltColorMap = Object.fromEntries(CLT_COLOR_ORDER);

const chartConfig = {
  Intrinsic: {
    label: "Intrinsic",
    color: "var(--color-chart-3)",
  },
  Extraneous: {
    label: "Extraneous",
    color: "var(--color-chart-4)",
  },
} satisfies ChartConfig;

export function CltDistChart({
  data,
  className,
  onSelectCategory,
  opening,
  onCancelOpen,
  onRetryOpen,
}: CltDistChartProps) {
  const categorizedData = useMemo(
    () => data.filter((entry) => !isUncategorized(entry.label)),
    [data],
  );
  const totalFeedback = data.reduce((sum, d) => sum + d.value, 0);
  const uncategorizedCount = data.find((entry) => isUncategorized(entry.label))?.value ?? 0;
  const interpretation = interpretDistribution(categorizedData, {
    kind: "clt",
    totalFeedback,
    uncategorizedCount,
  });
  const isEmpty = categorizedData.length === 0;
  // Ref avoids re-rendering the chart on every tooltip coordinate change.
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const handleCoordinate = useCallback((c: { x: number; y: number } | null) => {
    if (!c) return;
    const prev = anchorRef.current;
    if (prev && prev.x === c.x && prev.y === c.y) return;
    anchorRef.current = { x: c.x, y: c.y };
  }, []);
  const panelOpen = opening != null && opening.status !== "idle";

  const intrinsic = categorizedData.find((e) => e.label === "Intrinsic")?.value ?? 0;
  const extraneous = categorizedData.find((e) => e.label === "Extraneous")?.value ?? 0;

  const chartData = useMemo(
    () => [{ group: "Cognitive load", Intrinsic: intrinsic, Extraneous: extraneous }],
    [intrinsic, extraneous],
  );
  // Cap the axis at the highest category, not the total count.
  const maxCategory = Math.max(1, intrinsic, extraneous);

  return (
    <AnalysisCard className={className}>
      <CardHeader>
        <CardTitle className="text-base">CLT distribution</CardTitle>
        <CardDescription>Cognitive-load type split.</CardDescription>
        <InterpretationBlock text={interpretation} />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-[320px]">
        {isEmpty ? (
          <DistributionEmptyState
            className="flex-1"
            title="No CLT pattern to display"
            description={
              uncategorizedCount > 0
                ? "All responses were Uncategorized, so no cognitive-load pattern could be shown."
                : "No feedback was available for this distribution."
            }
          />
        ) : (
          <div className="relative h-full w-full">
            <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="group" tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis type="number" domain={[0, maxCategory]} allowDecimals={false} />
                {!panelOpen && (
                  <ChartTooltip
                    {...chartTooltipProps}
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        colorMap={cltColorMap}
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
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="Intrinsic"
                  fill={cltColorMap["Intrinsic"]}
                  radius={4}
                  onClick={() => {
                    const entry = categorizedData.find((d) => d.label === "Intrinsic");
                    if (entry) onSelectCategory?.(entry);
                  }}
                />
                <Bar
                  dataKey="Extraneous"
                  fill={cltColorMap["Extraneous"]}
                  radius={4}
                  onClick={() => {
                    const entry = categorizedData.find((d) => d.label === "Extraneous");
                    if (entry) onSelectCategory?.(entry);
                  }}
                />
              </BarChart>
            </ChartContainer>
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
