import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import type { DistEntry } from "@/lib/types/types";

const POLARITY_COLORS: Record<string, string> = {
  Positive: "var(--color-chart-1)",
  Neutral: "var(--color-chart-3)",
  Negative: "var(--color-chart-4)",
};

interface PolarityDistChartProps {
  data: DistEntry[];
}

export function PolarityDistChart({ data }: PolarityDistChartProps) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base">Polarity distribution</CardTitle>
        <CardDescription>Feedback tone distribution.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={3}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={POLARITY_COLORS[entry.label] ?? "var(--color-chart-2)"}
                />
              ))}
            </Pie>
            <Tooltip
              {...chartTooltipProps}
              offset={20}
              content={<ChartTooltipContent colorMap={POLARITY_COLORS} />}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
