import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendPoint } from "@/lib/hooks/metrics";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
];

interface RbtCltTrendCardProps {
  trend: TrendPoint[];
  dataKey: "aspectDist" | "issueDist" | "rbtDist" | "cltDist";
  title: string;
  description: string;
}

export function RbtCltTrendCard({ trend, dataKey, title, description }: RbtCltTrendCardProps) {
  const analyzed = trend.filter((p) => p[dataKey].length > 0);

  if (analyzed.length === 0) {
    return (
      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Distribution trend will appear after multiple sessions are analyzed.
          </p>
        </CardContent>
      </Card>
    );
  }

  const allLabels = [...new Set(analyzed.flatMap((p) => p[dataKey].map((d) => d.label)))];
  const colorMap = Object.fromEntries(allLabels.map((label, i) => [label, CHART_COLORS[i % CHART_COLORS.length]]));

  const chartData = analyzed.map((p) => {
    const entry: Record<string, string | number> = { topic: p.topic };
    for (const dist of p[dataKey]) {
      entry[dist.label] = dist.value;
    }
    for (const label of allLabels) {
      if (!(label in entry)) entry[label] = 0;
    }
    return entry;
  });

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {allLabels.map((label) => (
              <Bar key={label} dataKey={label} stackId="stack" fill={colorMap[label]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
