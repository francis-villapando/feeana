import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { ArrowLeft, Copy, Target, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ClassStudentsTab } from "@/components/ClassStudentsTab";
import { CreateSessionForm } from "@/components/CreateSessionForm";
import { SessionCard } from "@/components/SessionCard";
import { useClassStore } from "@/lib/classStore";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { MOCK_CLASSES } from "@/lib/mockData";
import {
  aspectTrendData,
  averageRate,
  iloAchievementForSession,
  submissionRateForSession,
} from "@/lib/metrics";

export const Route = createFileRoute("/_instructor/classes/$classId")({
  loader: ({ params }) => {
    const cls = MOCK_CLASSES.find((c) => c.id === params.classId);
    return { seed: cls ?? null };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.seed
          ? `${loaderData.seed.course} · ${loaderData.seed.section} — Feeana`
          : "Class — Feeana",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Class not found</h1>
      <Button asChild variant="ghost" className="mt-4">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </Button>
    </div>
  ),
  component: ClassLayout,
});

function ClassLayout() {
  const { classId } = Route.useParams();
  const { getClass, sessionsForClass } = useClassStore();
  const { feedback } = useFeedbackStore();
  const cls = getClass(classId);
  const location = useLocation();
  const sessions = sessionsForClass(classId);

  const submissionRate = useMemo(
    () =>
      averageRate(
        sessions.map((s) => submissionRateForSession(s, cls, feedback)),
      ),
    [sessions, cls, feedback],
  );
  const iloRate = useMemo(
    () => averageRate(sessions.map((s) => iloAchievementForSession(s, feedback))),
    [sessions, feedback],
  );
  const trend = useMemo(
    () => aspectTrendData(sessions, feedback),
    [sessions, feedback],
  );

  if (!cls) {
    throw notFound();
  }

  if (location.pathname.includes("/analysis/")) {
    return <Outlet />;
  }

  const copy = () => {
    navigator.clipboard.writeText(cls.code);
    toast.success("Class code copied");
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </Button>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiTile
          icon={<Users className="h-4 w-4" />}
          label="Submission rate"
          value={`${submissionRate}%`}
          hint="Average across sessions"
        />
        <KpiTile
          icon={<Target className="h-4 w-4" />}
          label="ILO achievement"
          value={`${iloRate}%`}
          hint="Average across sessions"
        />
      </div>

      {/* Trend card */}
      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Class trend
          </CardTitle>
          <CardDescription>
            Most prevalent aspect, issue, and polarity per session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Trend will appear once sessions collect feedback.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid stroke="oklch(1 0 0 / 8%)" vertical={false} />
                <XAxis
                  dataKey="topic"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(_, name, p) => {
                    const d = p.payload as Record<string, unknown>;
                    if (name === "aspect")
                      return [d.aspectLabel as string, "Top aspect"];
                    if (name === "issue")
                      return [d.issueLabel as string, "Top issue"];
                    if (name === "polarity")
                      return [d.polarityLabel as string, "Polarity"];
                    return [String(_), String(name)];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="aspect"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  name="Aspect"
                />
                <Line
                  type="monotone"
                  dataKey="issue"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  name="Issue"
                />
                <Line
                  type="monotone"
                  dataKey="polarity"
                  stroke="var(--color-chart-4)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  name="Polarity"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Two-column: tabs left, details + creator right */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Tabs defaultValue="sessions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
          </TabsList>
          <TabsContent value="sessions" className="space-y-4">
            <SessionsList classId={classId} />
          </TabsContent>
          <TabsContent value="students">
            <ClassStudentsTab classId={classId} />
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base">{cls.name}</CardTitle>
              <CardDescription>Class details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Course" value={cls.course} />
              <DetailRow label="Section" value={cls.section} />
              <DetailRow
                label="Students"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {cls.studentCount}
                  </span>
                }
              />
              <button
                type="button"
                onClick={copy}
                className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs hover:border-primary/40"
              >
                <span className="text-muted-foreground">Code</span>
                <span className="flex items-center gap-2 font-mono text-sm tracking-wider">
                  {cls.code}
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </span>
              </button>
            </CardContent>
          </Card>

          <CreateSessionForm classId={cls.id} />
        </div>
      </div>
    </div>
  );
}

function SessionsList({ classId }: { classId: string }) {
  const { sessionsForClass } = useClassStore();
  const sessions = sessionsForClass(classId);
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
        <h3 className="text-base font-semibold">No collections yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Start your first feedback collection from the form on the right.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            {icon}
          </span>
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight">
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
