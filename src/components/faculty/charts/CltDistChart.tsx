import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import type { DistEntry } from "@/lib/types/types";

interface CltDistChartProps {
  data: DistEntry[];
}

export function CltDistChart({ data }: CltDistChartProps) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base">CLT distribution</CardTitle>
        <CardDescription>Cognitive-load type split.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 48)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 'dataMax']} allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis
              type="category"
              dataKey="label"
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              width={120}
            />
            <Tooltip {...chartTooltipProps} content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={entry.label === "Intrinsic" ? "var(--color-chart-4)" : "var(--color-chart-2)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
