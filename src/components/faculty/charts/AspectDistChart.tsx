import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import type { DistEntry } from "@/lib/types/types";
import { SPECIAL_COLORS } from "@/lib/constants/chart-colors";

interface AspectDistChartProps {
  data: DistEntry[];
  totalFeedback: number;
}

export function AspectDistChart({ data, totalFeedback }: AspectDistChartProps) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Aspect distribution</CardTitle>
        <CardDescription>
          What students talked about across {totalFeedback} responses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 'dataMax']} allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis
              type="category"
              dataKey="label"
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              width={170}
            />
            <Tooltip {...chartTooltipProps} content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={SPECIAL_COLORS[entry.label] || "var(--color-chart-5)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
