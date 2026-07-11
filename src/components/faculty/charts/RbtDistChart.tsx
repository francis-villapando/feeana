import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution } from "./interpretDistribution";
import type { DistEntry } from "@/lib/types/types";
import { RBT_COLOR_ORDER } from "@/lib/constants/chartColors";

interface RbtDistChartProps {
  data: DistEntry[];
}

export function RbtDistChart({ data }: RbtDistChartProps) {
  const colorMap = Object.fromEntries(RBT_COLOR_ORDER);
  const totalFeedback = data.reduce((sum, d) => sum + d.value, 0);
  const interpretation = interpretDistribution(data, { kind: "rbt", totalFeedback });

  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <AnalysisCard>
      <CardHeader>
        <CardTitle className="text-base">RBT distribution</CardTitle>
        <CardDescription>Cognitive-process level distribution.</CardDescription>
        <InterpretationBlock text={interpretation} />
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
    </AnalysisCard>
  );
}
