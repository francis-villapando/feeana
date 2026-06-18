import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecommendationTrendPoint } from "@/lib/hooks/metrics";

export function ClassTrendCard({ trend }: { trend: RecommendationTrendPoint[] }) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" /> Class trend
        </CardTitle>
        <CardDescription>
          Number of recommendations and average polarity per analyzed session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Trend will appear after you trigger analysis on at least one session.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis
                yAxisId="recs"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="polarity"
                orientation="right"
                domain={[-1, 1]}
                stroke="var(--color-muted-foreground)"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                yAxisId="recs"
                type="monotone"
                dataKey="recommendations"
                stroke="var(--color-chart-1)"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                name="Recommendations"
              />
              <Line
                yAxisId="polarity"
                type="monotone"
                dataKey="avgPolarity"
                stroke="var(--color-chart-4)"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                name="Avg polarity"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
