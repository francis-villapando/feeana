import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution } from "./interpretDistribution";
import type { DistEntry } from "@/lib/types/types";
import { CLT_COLOR_ORDER } from "@/lib/constants/chartColors";

interface CltDistChartProps {
  data: DistEntry[];
  className?: string;
}

const cltColorMap = Object.fromEntries(CLT_COLOR_ORDER);

const chartConfig = {
  Intrinsic: {
    label: "Intrinsic",
    color: "var(--color-chart-3)",
  },
  Extraneous: {
    label: "Extraneous",
    color: "var(--color-chart-4)",
  },
} satisfies ChartConfig;

export function CltDistChart({ data, className }: CltDistChartProps) {
  const categorizedData = data.filter((entry) => entry.label !== "Uncategorized");
  const totalFeedback = data.reduce((sum, d) => sum + d.value, 0);
  const interpretation = interpretDistribution(categorizedData, { kind: "clt", totalFeedback });

  const intrinsic = categorizedData.find((e) => e.label === "Intrinsic")?.value ?? 0;
  const extraneous = categorizedData.find((e) => e.label === "Extraneous")?.value ?? 0;

  const chartData = [{ group: "Cognitive load", Intrinsic: intrinsic, Extraneous: extraneous }];

  return (
    <AnalysisCard className={className}>
      <CardHeader>
        <CardTitle className="text-base">CLT distribution</CardTitle>
        <CardDescription>Cognitive-load type split.</CardDescription>
        <InterpretationBlock text={interpretation} />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-[320px]">
        <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="group" tickLine={false} tickMargin={10} axisLine={false} />
            <YAxis type="number" domain={[0, Math.max(totalFeedback, 1)]} allowDecimals={false} />
            <ChartTooltip
              {...chartTooltipProps}
              cursor={false}
              content={<ChartTooltipContent colorMap={cltColorMap} dist={categorizedData} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="Intrinsic" fill="var(--color-Intrinsic)" radius={4} />
            <Bar dataKey="Extraneous" fill="var(--color-Extraneous)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </AnalysisCard>
  );
}
