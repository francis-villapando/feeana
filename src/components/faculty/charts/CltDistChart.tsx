import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution } from "./interpretDistribution";
import type { DistEntry } from "@/lib/types/types";
import { CHART_COLORS, CLT_COLOR_ORDER } from "@/lib/constants/chartColors";
import { toTitleCase } from "@/lib/hooks/utils";

interface CltDistChartProps {
  data: DistEntry[];
}

const cltColorMap = Object.fromEntries(CLT_COLOR_ORDER);

export function CltDistChart({ data }: CltDistChartProps) {
  const categorizedData = data.filter((entry) => entry.label !== "Uncategorized");
  const totalFeedback = data.reduce((sum, d) => sum + d.value, 0);
  const interpretation = interpretDistribution(categorizedData, { kind: "clt", totalFeedback });

  return (
    <AnalysisCard>
      <CardHeader>
        <CardTitle className="text-base">CLT distribution</CardTitle>
        <CardDescription>Cognitive-load type split.</CardDescription>
        <InterpretationBlock text={interpretation} />
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={categorizedData}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={(label: string) => toTitleCase(label)}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
            />
            <YAxis
              type="number"
              domain={[0, Math.max(totalFeedback, 1)]}
              allowDecimals={false}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
            />
            <Tooltip
              {...chartTooltipProps}
              content={<ChartTooltipContent colorMap={cltColorMap} />}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
              {categorizedData.map((entry) => (
                <Cell key={entry.label} fill={cltColorMap[entry.label] || CHART_COLORS[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </AnalysisCard>
  );
}
