import { createFileRoute, Link, notFound, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Target, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ClassDetailsCard, ConfirmationDialog, ClassStudentsTab, SessionCreator, SessionCard as FacultySessionCard } from "@/components/faculty";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAnalysisStore } from "@/lib/analysisStore";
import { useClassStore } from "@/lib/classStore";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { supabase } from "@/lib/supabase";
import { fromDbFeedback } from "@/lib/services/feedbackService";
import {
  averageRate,
  iloAchievementForClass,
  iloAchievementForSession,
  recommendationTrendData,
  submissionRateForSession,
} from "@/lib/metrics";

export const Route = createFileRoute("/_faculty/$classId")({
  loader: async ({ params }) => {
    return { classId: params.classId };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.classId ? `Class — Feeana` : "Class — Feeana",
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
  const { getClass, sessionsForClass, studentCountForClass, isLoading, archiveClass, refreshStudents } = useClassStore();
  const { feedback, fetchFeedbackByClass, insertRealtimeFeedback } = useFeedbackStore();
  const { results, fetchForSessions } = useAnalysisStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const cls = getClass(classId);
  const sessions = sessionsForClass(classId);

  const sessionIdsKey = useMemo(() => sessions.map((s) => s.id).join(","), [sessions]);

  useEffect(() => {
    if (classId) {
      fetchFeedbackByClass(classId);
      refreshStudents(classId);
    }
  }, [classId, fetchFeedbackByClass, refreshStudents]);

  useEffect(() => {
    if (sessionIdsKey) {
      const ids = sessionIdsKey.split(",").filter(Boolean);
      if (ids.length > 0) {
        fetchForSessions(ids);
      }
    }
  }, [sessionIdsKey, fetchForSessions]);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  useEffect(() => {
    if (!classId) return;

    const channel = supabase
      .channel(`feedback-class-${classId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback" },
        (payload) => {
          const newFb = payload.new as Record<string, unknown>;
          const fbSessionId = newFb.session_id as string;
          if (sessionsRef.current.some((s) => s.id === fbSessionId)) {
            insertRealtimeFeedback(fromDbFeedback(newFb));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, insertRealtimeFeedback]);

  const submissionRate = useMemo(
    () => averageRate(sessions.map((s) => submissionRateForSession(s, cls, feedback))),
    [sessions, cls, feedback],
  );
  const iloRate = useMemo(
    () => iloAchievementForClass(sessions, results),
    [sessions, results],
  );
  const trend = useMemo(
    () => recommendationTrendData(sessions, results, feedback),
    [sessions, results, feedback],
  );

  if (location.pathname.includes("/analysis/")) {
    return <Outlet />;
  }

  if (isLoading) {
    return <ClassLoadingSkeleton />;
  }

  if (!cls) {
    throw notFound();
  }

  const copy = () => {
    navigator.clipboard.writeText(cls?.enrollCode ?? "");
    toast.success("Enroll code copied");
  };

  const handleArchive = async () => {
    if (!cls) return;
    try {
      await archiveClass(cls.id);
      toast.success("Class archived");
      setArchiveOpen(false);
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive");
    }
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
          hint="Class achievement rate"
        />
      </div>

      {/* Trend card */}
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

      {/* Trend interpretation */}
      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">Trend interpretation</CardTitle>
          <CardDescription>AI-generated insights from class performance data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
            {trend.length === 0 ? (
              <p>Trend interpretation will appear once you have enough analyzed sessions.</p>
            ) : (
              <p>Interpreting class trends over time...</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-column: tabs left, details + creator right */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4 lg:col-start-2 lg:row-start-1">
          <ClassDetailsCard
            cls={cls}
            studentCount={studentCountForClass(classId)}
            onCopy={copy}
            onArchive={() => setArchiveOpen(true)}
          />

          <SessionCreator classId={cls.id} />
        </div>

        <Tabs defaultValue="sessions" className="space-y-4 lg:col-start-1 lg:row-start-1">
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
      </div>

      <ConfirmationDialog
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
        title="Archive class"
        description={`Archive the "${cls.courseCode}" class? This class will be hidden from your dashboard but can be restored later.`}
        actionType="archive"
      />
    </div>
  );
}

function SessionsList({ classId }: { classId: string }) {
  const { sessionsForClass } = useClassStore();
  const sessions = sessionsForClass(classId);
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
        <h3 className="text-base font-semibold">No sessions yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Start your first feedback session from the form on the right.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sessions.map((s) => (
        <FacultySessionCard key={s.id} session={s} />
      ))}
    </div>
  );
}

function ClassLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-24" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-80" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64" />
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
        </div>
      </div>
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
        <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
