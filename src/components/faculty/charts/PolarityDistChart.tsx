import { useCallback, useRef } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { FeedbackOpenPanel, type FeedbackOpenState } from "./FeedbackOpenPanel";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution } from "./interpretDistribution";
import type { DistEntry } from "@/lib/types/types";
import { POLARITY_COLOR_ORDER } from "@/lib/constants/chartColors";

const polarityColorMap = Object.fromEntries(POLARITY_COLOR_ORDER);

interface PolarityDistChartProps {
  data: DistEntry[];
  className?: string;
  onSelectCategory?: (entry: DistEntry) => void;
  opening?: FeedbackOpenState | null;
  onCancelOpen?: () => void;
  onRetryOpen?: () => void;
}

export function PolarityDistChart({
  data,
  className,
  onSelectCategory,
  opening,
  onCancelOpen,
  onRetryOpen,
}: PolarityDistChartProps) {
  const totalFeedback = data.reduce((sum, d) => sum + d.value, 0);
  const interpretation = interpretDistribution(data, { kind: "polarity", totalFeedback });
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
        <CardTitle className="text-base">Polarity distribution</CardTitle>
        <CardDescription>Feedback tone distribution.</CardDescription>
        <InterpretationBlock text={interpretation} />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-[320px]">
        <div className="relative flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={50}
                outerRadius={85}
                stroke="none"
                paddingAngle={3}
                onClick={(entry) => {
                  const label = (entry as { label?: string } | null)?.label;
                  const found = label ? data.find((d) => d.label === label) : undefined;
                  if (found) onSelectCategory?.(found);
                }}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.label}
                    fill={polarityColorMap[entry.label] ?? "var(--color-chart-1)"}
                  />
                ))}
              </Pie>
              {!panelOpen && (
                <Tooltip
                  {...chartTooltipProps}
                  content={
                    <ChartTooltipContent
                      colorMap={polarityColorMap}
                      dist={data}
                      freezeOnClick
                      onCoordinateChange={handleCoordinate}
                      onSelect={(item) => {
                        const entry = data.find((d) => d.label === item.label);
                        if (entry) onSelectCategory?.(entry);
                      }}
                    />
                  }
                />
              )}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
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
      </CardContent>
    </AnalysisCard>
  );
}
