import { createFileRoute } from "@tanstack/react-router";
import { LineChart as LineIcon, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_instructor/classes/$classId/trend")({
  head: () => ({
    meta: [{ title: "Class trend — Feeana" }],
  }),
  component: TrendTab,
});

const SENTIMENT_TREND = [
  { session: "Variables", positive: 42, negative: 50 },
  { session: "Control Flow", positive: 50, negative: 35 },
  { session: "Functions", positive: 60, negative: 28 },
  { session: "Lists", positive: 65, negative: 22 },
];

const ISSUE_PERSISTENCE = [
  { aspect: "Pacing", before: 6, after: 3 },
  { aspect: "Examples", before: 5, after: 2 },
  { aspect: "Practice", before: 4, after: 2 },
  { aspect: "Materials", before: 3, after: 1 },
  { aspect: "Content", before: 7, after: 4 },
];

function TrendTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Sentiment trend
          </CardTitle>
          <CardDescription>
            Positive vs negative share across this class's sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={SENTIMENT_TREND}>
              <CartesianGrid stroke="oklch(1 0 0 / 8%)" vertical={false} />
              <XAxis dataKey="session" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="positive" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="negative" stroke="var(--color-chart-4)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LineIcon className="h-4 w-4 text-primary" /> Issue persistence
          </CardTitle>
          <CardDescription>
            Negative mentions per aspect, before and after intervention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ISSUE_PERSISTENCE}>
              <CartesianGrid stroke="oklch(1 0 0 / 8%)" vertical={false} />
              <XAxis dataKey="aspect" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip
                cursor={{ fill: "oklch(1 0 0 / 5%)" }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="before" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="after" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
