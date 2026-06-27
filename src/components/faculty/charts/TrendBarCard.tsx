import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_COLORS, SPECIAL_COLORS, RBT_COLOR_ORDER, CLT_COLOR_ORDER, ASPECT_COLOR_ORDER, ISSUE_COLOR_ORDER } from "@/lib/constants/chartColors";
import type { TrendPoint } from "@/lib/hooks/metrics";

type BarView = "aspect" | "issue" | "rbt" | "clt";

const VIEW_CONFIG: Record<BarView, { description: string; dataKey: "aspectDist" | "issueDist" | "rbtDist" | "cltDist" }> = {
  aspect: {
    description: "Student concern areas per session.",
    dataKey: "aspectDist",
  },
  issue: {
    description: "Specific PID-ABSA issues extracted per session.",
    dataKey: "issueDist",
  },
  rbt: {
    description: "Bloom's cognitive-process level distribution per session.",
    dataKey: "rbtDist",
  },
  clt: {
    description: "Intrinsic vs extraneous cognitive load per session.",
    dataKey: "cltDist",
  },
};

export function TrendBarCard({ trend }: { trend: TrendPoint[] }) {
  const [view, setView] = useState<BarView>("aspect");

  const { description, dataKey } = VIEW_CONFIG[view];

  const analyzed = trend.filter((p) => p[dataKey].length > 0);

  const presentLabels = new Set(analyzed.flatMap((p) => p[dataKey].map((d) => d.label)));

  let allLabels: string[];
  let colorMap: Record<string, string>;

  if (dataKey === "rbtDist") {
    const ordered = RBT_COLOR_ORDER.filter(([label]) => presentLabels.has(label));
    allLabels = ordered.map(([label]) => label);
    colorMap = Object.fromEntries(ordered);
  } else if (dataKey === "cltDist") {
    const ordered = CLT_COLOR_ORDER.filter(([label]) => presentLabels.has(label));
    allLabels = ordered.map(([label]) => label);
    colorMap = Object.fromEntries(ordered);
  } else if (dataKey === "aspectDist") {
    const ordered = ASPECT_COLOR_ORDER.filter(([label]) => presentLabels.has(label));
    allLabels = ordered.map(([label]) => label);
    colorMap = Object.fromEntries(ordered);
  } else if (dataKey === "issueDist") {
    const ordered = ISSUE_COLOR_ORDER.filter(([label]) => presentLabels.has(label));
    allLabels = ordered.map(([label]) => label);
    colorMap = Object.fromEntries(ordered);
  } else {
    allLabels = [...presentLabels];
    colorMap = Object.fromEntries(
      allLabels.map((label, i) => [
        label,
        SPECIAL_COLORS[label] || CHART_COLORS[i % CHART_COLORS.length],
      ]),
    );
  }

  const chartData = analyzed.map((p) => {
    const entry: Record<string, string | number> = { topic: p.topic };
    for (const dist of p[dataKey]) {
      entry[dist.label] = dist.value;
    }
    for (const label of allLabels) {
      if (!(label in entry)) entry[label] = 0;
    }
    return entry;
  });

  return (
    <AnalysisCard>
      <CardHeader>
        <Tabs value={view} onValueChange={(v) => setView(v as BarView)}>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> Trend bar
            </CardTitle>
            <TabsList className="hidden sm:inline-flex">
              <TabsTrigger value="aspect">Aspect</TabsTrigger>
              <TabsTrigger value="issue">Issue</TabsTrigger>
              <TabsTrigger value="rbt">RBT</TabsTrigger>
              <TabsTrigger value="clt">CLT</TabsTrigger>
            </TabsList>
            <Select value={view} onValueChange={(v) => setView(v as BarView)}>
              <SelectTrigger className="sm:hidden min-w-[60px] max-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aspect">Aspect</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="rbt">RBT</SelectItem>
                <SelectItem value="clt">CLT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardDescription>{description}</CardDescription>
          <TabsContent value={view} className="mt-4">
            {analyzed.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Trend will appear after you trigger analysis on at least one session.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="topic" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip
                    cursor={{ fill: "var(--color-border)" }}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    itemSorter={(item) => -allLabels.indexOf(item.name as string)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {allLabels.map((label) => (
                    <Bar key={label} dataKey={label} stackId="stack" fill={colorMap[label]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
        </Tabs>
      </CardHeader>
    </AnalysisCard>
  );
}
