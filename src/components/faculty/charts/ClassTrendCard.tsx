import { TrendingUp } from "lucide-react";
import { useState } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TrendPoint } from "@/lib/hooks/metrics";

type TrendView = "engagement" | "polarity" | "issues";

const VIEW_CONFIG: Record<TrendView, { label: string; description: string }> = {
  engagement: {
    label: "Engagement",
    description: "Submission rate and ILO achievement per analyzed session.",
  },
  polarity: {
    label: "Polarity",
    description: "Average student polarity per analyzed session.",
  },
  issues: {
    label: "Issues",
    description: "Recommendation and warning counts per analyzed session.",
  },
};

export function ClassTrendCard({ trend }: { trend: TrendPoint[] }) {
  const [view, setView] = useState<TrendView>("engagement");

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Class trend
          </CardTitle>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as TrendView)}
            size="sm"
          >
            <ToggleGroupItem value="engagement">Engagement</ToggleGroupItem>
            <ToggleGroupItem value="polarity">Polarity</ToggleGroupItem>
            <ToggleGroupItem value="issues">Issues</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <CardDescription>{VIEW_CONFIG[view].description}</CardDescription>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Trend will appear after you trigger analysis on at least one session.
          </p>
        ) : (
          <TrendChart trend={trend} view={view} />
        )}
      </CardContent>
    </Card>
  );
}

function TrendChart({ trend, view }: { trend: TrendPoint[]; view: TrendView }) {
  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
  };

  if (view === "engagement") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={trend}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="var(--color-muted-foreground)" fontSize={11} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="submissionRate" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 4 }} name="Submission rate" />
          <Line type="monotone" dataKey="iloAchievement" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 4 }} name="ILO achievement" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (view === "polarity") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={trend}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
          <YAxis domain={[-1, 1]} tickFormatter={(v) => v.toFixed(1)} stroke="var(--color-muted-foreground)" fontSize={11} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toFixed(2)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="avgPolarity" stroke="var(--color-chart-4)" strokeWidth={2.5} dot={{ r: 4 }} name="Avg polarity" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={trend}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="recommendationCount" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 4 }} name="Recommendations" />
        <Line type="monotone" dataKey="warningCount" stroke="var(--color-chart-3)" strokeWidth={2.5} dot={{ r: 4 }} name="Warnings" />
      </LineChart>
    </ResponsiveContainer>
  );
}
