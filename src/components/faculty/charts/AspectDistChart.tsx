import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution } from "./interpretDistribution";
import type { DistEntry } from "@/lib/types/types";
import { CHART_COLORS, ASPECT_COLOR_ORDER } from "@/lib/constants/chartColors";

interface AspectDistChartProps {
  data: DistEntry[];
  totalFeedback: number;
}

const aspectColorMap = Object.fromEntries(ASPECT_COLOR_ORDER);

export function AspectDistChart({ data, totalFeedback }: AspectDistChartProps) {
  const interpretation = interpretDistribution(data, { kind: "aspect", totalFeedback });

  return (
    <AnalysisCard className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Aspect distribution</CardTitle>
        <CardDescription>
          What students talked about across {totalFeedback} responses.
        </CardDescription>
        <InterpretationBlock text={interpretation} />
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
            <Tooltip {...chartTooltipProps} content={<ChartTooltipContent colorMap={aspectColorMap} />} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={aspectColorMap[entry.label] || CHART_COLORS[0]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </AnalysisCard>
  );
}
