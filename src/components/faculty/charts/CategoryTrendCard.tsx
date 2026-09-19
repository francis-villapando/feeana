import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { BAR_VIEW_CONFIG, type BarView } from "./config";
import { aggregateTopCategories } from "./utils/categoryAggregation";
import { TooltipRow } from "./utils/tooltipRow";
import { TrendEmptyState } from "./utils/trendEmptyState";
import { ViewSwitcher } from "./utils/viewSwitcher";
import type { TrendPoint } from "@/lib/hooks/metrics";

const VIEWS: { value: BarView; label: string }[] = Object.entries(BAR_VIEW_CONFIG).map(
  ([value, config]) => ({ value: value as BarView, label: config.label }),
);

export function CategoryTrendCard({ trend }: { trend: TrendPoint[] }) {
  const [view, setView] = useState<BarView>("aspect");

  const { description, dataKey, alwaysShow, colorOrder } = BAR_VIEW_CONFIG[view];

  const analyzed = useMemo(() => trend.filter((p) => p[dataKey].length > 0), [trend, dataKey]);

  const { labels, colorMap, chartData } = useMemo(
    () => aggregateTopCategories(analyzed, dataKey, colorOrder, alwaysShow),
    [analyzed, dataKey, alwaysShow, colorOrder],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const label of labels) {
      config[label] = { label, color: colorMap[label] };
    }
    return config;
  }, [labels, colorMap]);

  return (
    <AnalysisCard>
      <CardHeader>
        <Tabs value={view} onValueChange={(v) => setView(v as BarView)}>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> Trend distribution
            </CardTitle>
            <ViewSwitcher views={VIEWS} value={view} onValueChange={setView} />
          </div>
          <CardDescription className="mt-1">{description}</CardDescription>
          <TabsContent value={view} className="mt-4">
            {analyzed.length === 0 ? (
              <TrendEmptyState />
            ) : (
              <ChartContainer config={chartConfig} className="h-[360px] w-full">
                <LineChart key={view} data={chartData} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="topic" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    domain={[0, "dataMax"]}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    padding={{ top: 10, bottom: 8 }}
                  />
                  <ChartTooltip
                    itemSorter={(item) => -(item.value as number)}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        formatter={(value, name, item) => (
                          <TooltipRow
                            color={item.color}
                            label={chartConfig[String(name)]?.label ?? name}
                            value={String(value)}
                          />
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
                  {labels.map((label) => (
                    <Line
                      key={label}
                      type="monotone"
                      dataKey={label}
                      stroke={colorMap[label]}
                      strokeWidth={2}
                      dot={{ r: 2, strokeWidth: 0, fill: colorMap[label] }}
                      activeDot={{ r: 5, strokeWidth: 0, fill: colorMap[label] }}
                      animationDuration={300}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </TabsContent>
        </Tabs>
      </CardHeader>
    </AnalysisCard>
  );
}
