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

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_COLORS } from "@/lib/constants/chartColors";
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

export function TrendLineCard({ trend }: { trend: TrendPoint[] }) {
  const [view, setView] = useState<TrendView>("engagement");

  return (
    <AnalysisCard>
      <CardHeader>
        <Tabs value={view} onValueChange={(v) => setView(v as TrendView)}>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Trend line
            </CardTitle>
            <TabsList className="hidden sm:inline-flex">
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="polarity">Polarity</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
            </TabsList>
            <Select value={view} onValueChange={(v) => setView(v as TrendView)}>
              <SelectTrigger className="sm:hidden min-w-[60px] max-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engagement">Engagement</SelectItem>
                <SelectItem value="polarity">Polarity</SelectItem>
                <SelectItem value="issues">Issues</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardDescription>{VIEW_CONFIG[view].description}</CardDescription>
          <TabsContent value="engagement" className="mt-4">
            {trend.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Trend will appear after you trigger analysis on at least one session.
              </p>
            ) : (
              <EngagementChart trend={trend} />
            )}
          </TabsContent>
          <TabsContent value="polarity" className="mt-4">
            {trend.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Trend will appear after you trigger analysis on at least one session.
              </p>
            ) : (
              <PolarityChart trend={trend} />
            )}
          </TabsContent>
          <TabsContent value="issues" className="mt-4">
            {trend.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Trend will appear after you trigger analysis on at least one session.
              </p>
            ) : (
              <IssuesChart trend={trend} />
            )}
          </TabsContent>
        </Tabs>
      </CardHeader>
    </AnalysisCard>
  );
}

function EngagementChart({ trend }: { trend: TrendPoint[] }) {
  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={trend}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          stroke="var(--color-muted-foreground)"
          fontSize={11}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value}%`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="submissionRate"
          stroke={CHART_COLORS[0]}
          strokeWidth={2.5}
          dot={{ r: 4 }}
          name="Submission rate"
        />
        <Line
          type="monotone"
          dataKey="iloAchievement"
          stroke={CHART_COLORS[1]}
          strokeWidth={2.5}
          dot={{ r: 4 }}
          name="ILO achievement"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PolarityChart({ trend }: { trend: TrendPoint[] }) {
  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={trend}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis
          domain={[-1, 1]}
          tickFormatter={(v) => v.toFixed(1)}
          stroke="var(--color-muted-foreground)"
          fontSize={11}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toFixed(2)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="avgPolarity"
          stroke={CHART_COLORS[3]}
          strokeWidth={2.5}
          dot={{ r: 4 }}
          name="Avg polarity"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function IssuesChart({ trend }: { trend: TrendPoint[] }) {
  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={trend}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="recommendationCount"
          stroke={CHART_COLORS[0]}
          strokeWidth={2.5}
          dot={{ r: 4 }}
          name="Recommendations"
        />
        <Line
          type="monotone"
          dataKey="warningCount"
          stroke={CHART_COLORS[2]}
          strokeWidth={2.5}
          dot={{ r: 4 }}
          name="Warnings"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
