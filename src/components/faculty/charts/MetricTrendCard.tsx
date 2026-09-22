import { TrendingUp } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactElement, type Ref } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LINE_VIEW_CONFIG, type TrendView } from "./config";
import { renderGradients } from "./utils/gradients";
import {
  areaGradient,
  polarityLineGradient,
  polarityTrendGradient,
  type GradientSpec,
  type PlotArea,
} from "./utils/gradientSpecs";
import { getPolarityColor, polarityBucketLabel } from "./utils/polarityColor";
import { TooltipRow } from "./utils/tooltipRow";
import { TrendEmptyState } from "./utils/trendEmptyState";
import { ViewSwitcher } from "./utils/viewSwitcher";
import type { TrendPoint } from "@/lib/hooks/metrics";

const ENGAGEMENT_CONFIG: ChartConfig = {
  submissionRate: { label: "Submission rate", color: "var(--color-chart-1)" },
  iloAchievement: { label: "ILO achievement", color: "var(--color-chart-2)" },
};

const POLARITY_CONFIG: ChartConfig = {
  avgPolarity: { label: "Avg polarity", color: "var(--color-chart-3)" },
};

const ISSUES_CONFIG: ChartConfig = {
  primaryRecommendationCount: {
    label: "Primary recommendations",
    color: "var(--color-chart-1)",
  },
  secondaryRecommendationCount: {
    label: "Secondary recommendations",
    color: "var(--color-chart-3)",
  },
  warningCount: { label: "Warnings", color: "var(--color-chart-4)" },
};

const VIEWS: { value: TrendView; label: string }[] = Object.entries(LINE_VIEW_CONFIG).map(
  ([value, config]) => ({ value: value as TrendView, label: config.label }),
);

interface SeriesSpec {
  dataKey: string;
  color: string;
  /** Stroke color; defaults to `color`. Use `url(#gradientId)` for a gradient stroke. */
  stroke?: string;
  /** Gradient fill id; ignored when `fill` is set. */
  gradientId?: string;
  /** Fill up to this Y value instead of the axis min (e.g. 0 for polarity). */
  baseValue?: number;
  /** Solid fill color; overrides gradientId. */
  fill?: string;
  fillOpacity?: number;
  /** Custom per-point dot element (recharts clones it with cx/cy/value props; Area passes value as [baseValue, value]). */
  dot?: ReactElement;
  /** Per-value tooltip indicator color. */
  valueColor?: (value: number) => string;
}

interface ReferenceLineSpec {
  y: number;
  stroke?: string;
  strokeDasharray?: string;
  strokeOpacity?: number;
}

interface TrendAreaChartProps<T extends object> {
  data: T[];
  config: ChartConfig;
  series: SeriesSpec[];
  gradients: GradientSpec[];
  yDomain?: [number | string, number | string];
  yTickFormatter?: (value: number) => string;
  valueFormatter?: (value: number | string) => string;
  allowDecimals?: boolean;
  showLegend?: boolean;
  /** Optional secondary Y-axis rendered on the right (e.g. polarity labels). */
  rightAxis?: ReactElement;
  /** Horizontal reference lines (e.g. a dashed zero line). */
  referenceLines?: ReferenceLineSpec[];
  /** Ref to the chart container, for measuring the plot area. */
  containerRef?: Ref<HTMLDivElement>;
}

function TrendAreaChart<T extends object>({
  data,
  config,
  series,
  gradients,
  yDomain,
  yTickFormatter,
  valueFormatter,
  allowDecimals = true,
  showLegend = true,
  rightAxis,
  referenceLines,
  containerRef,
}: TrendAreaChartProps<T>) {
  return (
    <ChartContainer ref={containerRef} config={config} className="h-[280px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="topic" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          yAxisId="left"
          domain={yDomain}
          tickFormatter={yTickFormatter}
          allowDecimals={allowDecimals}
          tickLine={false}
          axisLine={false}
          width={44}
          padding={{ top: 10, bottom: 8 }}
        />
        {rightAxis}
        <ChartTooltip
          itemSorter={(item) => -(item.value as number)}
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(value, name, item) => {
                const s = series.find((x) => x.dataKey === String(name));
                const numeric = typeof value === "number" ? value : Number(value);
                return (
                  <TooltipRow
                    color={s?.valueColor ? s.valueColor(numeric) : item.color}
                    label={config[String(name)]?.label ?? name}
                    value={
                      valueFormatter
                        ? valueFormatter(typeof value === "number" ? value : String(value))
                        : String(value)
                    }
                  />
                );
              }}
            />
          }
        />
        {showLegend && <ChartLegend content={<ChartLegendContent />} />}
        {referenceLines?.map((line) => (
          <ReferenceLine
            key={line.y}
            yAxisId="left"
            y={line.y}
            stroke={line.stroke ?? "var(--color-muted-foreground)"}
            strokeDasharray={line.strokeDasharray}
            strokeOpacity={line.strokeOpacity}
            strokeWidth={1}
          />
        ))}
        {renderGradients(gradients)}
        {series.map((s) => (
          <Area
            key={s.dataKey}
            yAxisId="left"
            type="monotone"
            dataKey={s.dataKey}
            stroke={s.stroke ?? s.color}
            strokeWidth={2.5}
            fill={s.fill ?? `url(#${s.gradientId})`}
            fillOpacity={s.fillOpacity}
            baseValue={s.baseValue}
            connectNulls
            dot={(s.dot as ReactElement<SVGElement>) ?? { r: 3, strokeWidth: 0, fill: s.color }}
            activeDot={
              (s.dot as ReactElement<SVGElement>) ?? { r: 5, strokeWidth: 0, fill: s.color }
            }
            animationDuration={300}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

export function MetricTrendCard({ trend }: { trend: TrendPoint[] }) {
  const [view, setView] = useState<TrendView>("engagement");

  return (
    <AnalysisCard>
      <CardHeader>
        <Tabs value={view} onValueChange={(v) => setView(v as TrendView)}>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Trend line
            </CardTitle>
            <ViewSwitcher views={VIEWS} value={view} onValueChange={setView} />
          </div>
          <CardDescription>{LINE_VIEW_CONFIG[view].description}</CardDescription>
          <TabsContent value="engagement" className="mt-4">
            {trend.length === 0 ? <TrendEmptyState /> : <EngagementChart trend={trend} />}
          </TabsContent>
          <TabsContent value="polarity" className="mt-4">
            {trend.length === 0 ? <TrendEmptyState /> : <PolarityChart trend={trend} />}
          </TabsContent>
          <TabsContent value="issues" className="mt-4">
            {trend.length === 0 ? <TrendEmptyState /> : <IssuesChart trend={trend} />}
          </TabsContent>
        </Tabs>
      </CardHeader>
    </AnalysisCard>
  );
}

function EngagementChart({ trend }: { trend: TrendPoint[] }) {
  return (
    <TrendAreaChart
      data={trend}
      config={ENGAGEMENT_CONFIG}
      series={[
        { dataKey: "submissionRate", color: "var(--color-chart-1)", gradientId: "grad-submission" },
        { dataKey: "iloAchievement", color: "var(--color-chart-2)", gradientId: "grad-ilo" },
      ]}
      gradients={[
        areaGradient("grad-submission", "var(--color-chart-1)"),
        areaGradient("grad-ilo", "var(--color-chart-2)"),
      ]}
      yDomain={[0, 100]}
      yTickFormatter={(v) => `${v}%`}
      valueFormatter={(value) => `${value}%`}
    />
  );
}

function CustomPolarityDot(props: {
  cx?: number;
  cy?: number;
  r?: number;
  value?: number | [number | null, number];
}) {
  const { cx, cy, r, value } = props;
  if (cx == null || cy == null) return null;
  const polarity = Array.isArray(value) ? value[1] : value;
  return <circle cx={cx} cy={cy} r={r ?? 3} fill={getPolarityColor(polarity)} stroke="none" />;
}

/** Right-axis tick: colored Positive/Neutral/Negative label aligned to +1/0/-1. */
function PolarityAxisTick(props: { x?: number; y?: number; payload?: { value: number } }) {
  const { x, y, payload } = props;
  if (x == null || y == null || payload == null) return null;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="start"
      fontSize={12}
      fill={getPolarityColor(payload.value)}
    >
      {polarityBucketLabel(payload.value)}
    </text>
  );
}

function PolarityChart({ trend }: { trend: TrendPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plot, setPlot] = useState<PlotArea | null>(null);

  // Re-measure every render: the grid only exists once ResponsiveContainer has
  // sized the chart, so the first pass may find nothing yet. The equality guard
  // below stops the update once the plot area is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const grid = containerRef.current?.querySelector<SVGGElement>(".recharts-cartesian-grid");
    if (!grid) return;
    const { y, height } = grid.getBBox();
    setPlot((prev) => (prev && prev.y === y && prev.height === height ? prev : { y, height }));
  });

  return (
    <TrendAreaChart
      data={trend}
      config={POLARITY_CONFIG}
      containerRef={containerRef}
      series={[
        {
          dataKey: "avgPolarity",
          color: "var(--color-chart-3)",
          stroke: "url(#grad-polarity-line)",
          gradientId: "grad-polarity",
          baseValue: 0,
          dot: <CustomPolarityDot />,
          valueColor: getPolarityColor,
        },
      ]}
      gradients={[polarityTrendGradient(plot), polarityLineGradient(plot)]}
      referenceLines={[{ y: 0, strokeDasharray: "4 4", strokeOpacity: 0.5 }]}
      rightAxis={
        <YAxis
          yAxisId="right"
          orientation="right"
          axisLine={false}
          tickLine={false}
          width={72}
          domain={[-1, 1]}
          ticks={[-1, 0, 1]}
          allowDecimals={false}
          padding={{ top: 10, bottom: 8 }}
          tick={<PolarityAxisTick />}
        />
      }
      yDomain={[-1, 1]}
      yTickFormatter={(v) => Number(v).toFixed(1)}
      valueFormatter={(value) => (typeof value === "number" ? value.toFixed(2) : String(value))}
      showLegend={false}
    />
  );
}

function IssuesChart({ trend }: { trend: TrendPoint[] }) {
  return (
    <TrendAreaChart
      data={trend}
      config={ISSUES_CONFIG}
      series={[
        {
          dataKey: "primaryRecommendationCount",
          color: "var(--color-chart-1)",
          gradientId: "grad-primary",
        },
        {
          dataKey: "secondaryRecommendationCount",
          color: "var(--color-chart-3)",
          gradientId: "grad-secondary",
        },
        { dataKey: "warningCount", color: "var(--color-chart-4)", gradientId: "grad-warnings" },
      ]}
      gradients={[
        areaGradient("grad-primary", "var(--color-chart-1)"),
        areaGradient("grad-secondary", "var(--color-chart-3)"),
        areaGradient("grad-warnings", "var(--color-chart-4)"),
      ]}
      yDomain={[0, "dataMax"]}
      allowDecimals={false}
    />
  );
}
