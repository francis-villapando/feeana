import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { InterpretationBlock } from "./InterpretationBlock";
import { chartTooltipProps, ChartTooltipContent } from "@/components/analysis";
import { interpretDistribution } from "./interpretDistribution";
import type { DistEntry } from "@/lib/types/types";
import { RBT_COLOR_ORDER } from "@/lib/constants/chartColors";
import { RBT_LEVEL_NUMBERS } from "@/lib/algorithm/rules";

interface RbtDistChartProps {
  data: DistEntry[];
}

const RBT_LEVEL_ORDER = Object.entries(RBT_LEVEL_NUMBERS)
  .sort((a, b) => a[1] - b[1])
  .map(([label]) => label);

export function RbtDistChart({ data }: RbtDistChartProps) {
  const colorMap = Object.fromEntries(
    RBT_COLOR_ORDER.map(([label, color]) => {
      const num = RBT_LEVEL_NUMBERS[label];
      return [num ? `${label} (${num})` : label, color];
    }),
  );

  const categorizedData = data.filter((entry) => entry.label !== "Uncategorized");
  const totalFeedback = data.reduce((sum, d) => sum + d.value, 0);
  const interpretation = interpretDistribution(categorizedData, { kind: "rbt", totalFeedback });

  // Normalize to all 6 Bloom levels in clockwise order (1 -> 6) so the radar
  // always renders a full hexagon; missing levels render as zero-count vertices.
  const radarData: DistEntry[] = RBT_LEVEL_ORDER.map((level) => {
    const entry = categorizedData.find((d) => d.label === level);
    return {
      label: `${level} (${RBT_LEVEL_NUMBERS[level]})`,
      value: entry?.value ?? 0,
      feedbackTexts: entry?.feedbackTexts,
    };
  });

  const maxCount = Math.max(1, ...radarData.map((d) => d.value));

  return (
    <AnalysisCard>
      <CardHeader>
        <CardTitle className="text-base">RBT distribution</CardTitle>
        <CardDescription>Cognitive-process level distribution.</CardDescription>
        <InterpretationBlock text={interpretation} />
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="var(--color-border)" gridType="polygon" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            />
            <PolarRadiusAxis
              domain={[0, maxCount]}
              tickCount={Math.min(5, maxCount + 1)}
              tick={false}
              axisLine={false}
            />
            <Tooltip {...chartTooltipProps} content={<ChartTooltipContent colorMap={colorMap} />} />
            <Radar
              dataKey="value"
              fill="var(--color-chart-5)"
              fillOpacity={0.35}
              stroke="var(--color-chart-5)"
              strokeWidth={2}
              dot={{ r: 4, fillOpacity: 1 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </AnalysisCard>
  );
}
