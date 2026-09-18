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
import { CLT_COLOR_ORDER } from "@/lib/constants/chartColors";

interface CltDistChartProps {
  data: DistEntry[];
}

export function CltDistChart({ data }: CltDistChartProps) {
  const colorMap = Object.fromEntries(CLT_COLOR_ORDER);
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
        <ResponsiveContainer width="100%" height={Math.max(220, categorizedData.length * 48)}>
          <BarChart data={categorizedData} layout="vertical">
            <CartesianGrid stroke="var(--color-border)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, "dataMax"]}
              allowDecimals={false}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
            />
            <YAxis
              type="category"
              dataKey="label"
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              width={120}
            />
            <Tooltip {...chartTooltipProps} content={<ChartTooltipContent colorMap={colorMap} />} />
            <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]}>
              {categorizedData.map((entry) => (
                <Cell key={entry.label} fill={colorMap[entry.label] || "var(--color-chart-2)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </AnalysisCard>
  );
}
