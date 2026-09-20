import { useCallback, useMemo, useRef } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { FeedbackOpenPanel, type FeedbackOpenState } from "./FeedbackOpenPanel";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution, isUncategorized } from "./interpretDistribution";
import { DistributionEmptyState } from "./DistributionEmptyState";
import { resolveRbtSectorIndex } from "./rbtGeometry";
import type { DistEntry } from "@/lib/types/types";
import { RBT_COLOR_ORDER } from "@/lib/constants/chartColors";
import { RBT_LEVEL_NUMBERS } from "@/lib/algorithm/rules";

interface RbtDistChartProps {
  data: DistEntry[];
  className?: string;
  onSelectCategory?: (entry: DistEntry) => void;
  opening?: FeedbackOpenState | null;
  onCancelOpen?: () => void;
  onRetryOpen?: () => void;
}

const RBT_LEVEL_ORDER = Object.entries(RBT_LEVEL_NUMBERS)
  .sort((a, b) => a[1] - b[1])
  .map(([label]) => label);

const colorMap = Object.fromEntries(RBT_COLOR_ORDER);

interface RadarDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: { name?: string; value?: number };
}

interface AngleTickProps {
  x?: number;
  y?: number;
  textAnchor?: "start" | "middle" | "end" | "inherit";
  payload?: { value?: string | number };
}

export function RbtDistChart({
  data,
  className,
  onSelectCategory,
  opening,
  onCancelOpen,
  onRetryOpen,
}: RbtDistChartProps) {
  const categorizedData = useMemo(
    () => data.filter((entry) => !isUncategorized(entry.label)),
    [data],
  );
  const totalFeedback = data.reduce((sum, d) => sum + d.value, 0);
  const uncategorizedCount = data.find((entry) => isUncategorized(entry.label))?.value ?? 0;
  const interpretation = interpretDistribution(categorizedData, {
    kind: "rbt",
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

  // Always render all 6 Bloom levels; missing ones become zero-count vertices.
  const radarData = useMemo<DistEntry[]>(
    () =>
      RBT_LEVEL_ORDER.map((level) => {
        const entry = categorizedData.find((d) => d.label === level);
        return {
          label: level,
          value: entry?.value ?? 0,
          feedbackTexts: entry?.feedbackTexts ?? [],
        };
      }),
    [categorizedData],
  );

  const maxCount = Math.max(1, ...radarData.map((d) => d.value));
  const containerRef = useRef<HTMLDivElement>(null);

  // Map chart-area clicks to the nearest 60° sector.
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Ignore clicks originating from tooltip buttons/links.
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("a") || target.closest(".chart-tooltip")) {
        return;
      }

      const svg = containerRef.current?.querySelector("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cursor = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const center = {
        x: rect.width / 2,
        y: rect.height / 2,
      };

      const sectorIdx = resolveRbtSectorIndex(cursor, center);
      const entry = radarData[sectorIdx];
      if (entry) {
        onSelectCategory?.(entry);
      }
    },
    [radarData, onSelectCategory],
  );

  return (
    <AnalysisCard className={className}>
      <CardHeader>
        <CardTitle className="text-base">RBT distribution</CardTitle>
        <CardDescription>Cognitive-process level distribution.</CardDescription>
        <InterpretationBlock text={interpretation} />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-[320px]">
        {isEmpty ? (
          <DistributionEmptyState
            className="flex-1"
            title="No RBT pattern to display"
            description={
              uncategorizedCount > 0
                ? "All responses were Uncategorized, so no cognitive-process pattern could be shown."
                : "No feedback was available for this distribution."
            }
          />
        ) : (
          <div
            className="relative flex-1 cursor-pointer"
            ref={containerRef}
            onClick={handleContainerClick}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={radarData}
                cx="50%"
                cy="50%"
                outerRadius="62%"
                margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                startAngle={90}
                endAngle={-270}
              >
                <PolarGrid stroke="var(--color-border)" gridType="polygon" />
                <PolarAngleAxis
                  dataKey="label"
                  tick={(props: AngleTickProps) => {
                    const label = String(props.payload?.value ?? "");
                    const entry = radarData.find((d) => d.label === label);
                    return (
                      <text
                        x={props.x}
                        y={props.y}
                        textAnchor={props.textAnchor}
                        stroke="none"
                        fontSize={11}
                        fill="var(--color-muted-foreground)"
                        className="cursor-pointer hover:fill-foreground font-medium transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (entry) onSelectCategory?.(entry);
                        }}
                      >
                        {label}
                      </text>
                    );
                  }}
                />
                <PolarRadiusAxis
                  domain={[0, maxCount]}
                  tickCount={Math.min(5, maxCount + 1)}
                  tick={false}
                  axisLine={false}
                />
                {!panelOpen && (
                  <Tooltip
                    {...chartTooltipProps}
                    content={
                      <ChartTooltipContent
                        colorMap={colorMap}
                        dist={radarData}
                        onCoordinateChange={handleCoordinate}
                        onSelect={(item) => {
                          const entry = radarData.find((d) => d.label === item.label);
                          if (entry) onSelectCategory?.(entry);
                        }}
                      />
                    }
                  />
                )}
                <Radar
                  dataKey="value"
                  fill="var(--color-chart-5)"
                  fillOpacity={0.35}
                  stroke="var(--color-chart-5)"
                  strokeWidth={2}
                  dot={(props: RadarDotProps) => {
                    const label = props.payload?.name;
                    const entry =
                      props.index != null
                        ? radarData[props.index]
                        : radarData.find((d) => d.label === label);
                    // Skip hitboxes for zero-count vertices to avoid center collision.
                    if (!entry || entry.value === 0) {
                      return <g key={props.index ?? "empty-dot"} />;
                    }
                    return (
                      <g key={entry.label}>
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={18}
                          fill="transparent"
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCategory?.(entry);
                          }}
                        />
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={5}
                          fill="var(--color-chart-5)"
                          fillOpacity={1}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCategory?.(entry);
                          }}
                        />
                      </g>
                    );
                  }}
                />
              </RadarChart>
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
