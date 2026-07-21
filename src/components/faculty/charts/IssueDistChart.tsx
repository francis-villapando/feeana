import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution } from "./interpretDistribution";
import type { DistEntry } from "@/lib/types/types";
import { CHART_COLORS, ISSUE_COLOR_ORDER } from "@/lib/constants/chartColors";

interface IssueDistChartProps {
  data: DistEntry[];
}

const issueColorMap = Object.fromEntries(ISSUE_COLOR_ORDER);

export function IssueDistChart({ data }: IssueDistChartProps) {
  const totalFeedback = data.reduce((sum, d) => sum + d.value, 0);
  const interpretation = interpretDistribution(data, { kind: "issue", totalFeedback });

  return (
    <AnalysisCard className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">Issue distribution</CardTitle>
        <CardDescription>Specific concerns extracted via PID-ABSA.</CardDescription>
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
            <Tooltip {...chartTooltipProps} content={<ChartTooltipContent colorMap={issueColorMap} />} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={issueColorMap[entry.label] || CHART_COLORS[0]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </AnalysisCard>
  );
}
