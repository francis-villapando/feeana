import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import type { DistEntry } from "@/lib/types/types";
import { RBT_COLOR_ORDER } from "@/lib/constants/chart-colors";

interface RbtDistChartProps {
  data: DistEntry[];
}

export function RbtDistChart({ data }: RbtDistChartProps) {
  const colorMap = Object.fromEntries(RBT_COLOR_ORDER);
  const orderMap = Object.fromEntries(RBT_COLOR_ORDER.map(([label], index) => [label, index]));

  const sortedData = [...data].sort((a, b) => {
    const indexA = orderMap[a.label] ?? 999;
    const indexB = orderMap[b.label] ?? 999;
    return indexB - indexA;
  });

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">RBT distribution</CardTitle>
        <CardDescription>Cognitive-process level distribution.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, sortedData.length * 36)}>
          <BarChart data={sortedData} layout="vertical">
            <CartesianGrid stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 'dataMax']} allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis
              type="category"
              dataKey="label"
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              width={130}
            />
            <Tooltip {...chartTooltipProps} content={<ChartTooltipContent colorMap={colorMap} />} />
            <Bar dataKey="value" fill="var(--color-chart-5)" radius={[0, 6, 6, 0]}>
              {sortedData.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={colorMap[entry.label] || "var(--color-chart-2)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
