import { createFileRoute } from "@tanstack/react-router";
import { Database, GraduationCap, Target, Users } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { useClassStore } from "@/lib/classStore";
import { useAnalysisStore } from "@/lib/analysisStore";
import { averageRate, iloAchievementForClass, iloAchievementForSession, submissionRateForSession } from "@/lib/metrics";
import { CourseManagementHub, ActivityFeed } from "@/components/faculty/dashboard";
import { CrossClassSessionCreator, KpiCard } from "@/components/faculty";

export const Route = createFileRoute("/_faculty/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Feeana" },
      {
        name: "description",
        content: "Workspace KPIs, course management, and cross-class session launches.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { feedback } = useFeedbackStore();
  const { activeClasses, sessions, classes, isLoading } = useClassStore();
  const { results, fetchForSessions } = useAnalysisStore();

  const sessionIdsKey = useMemo(() => sessions.map((s) => s.id).join(","), [sessions]);

  useEffect(() => {
    if (sessionIdsKey) {
      const ids = sessionIdsKey.split(",").filter(Boolean);
      if (ids.length > 0) {
        fetchForSessions(ids);
      }
    }
  }, [sessionIdsKey, fetchForSessions]);

  const stats = useMemo(() => {
    const active = sessions.filter((s) => s.status === "active").length;
    const submission = averageRate(
      sessions.map((s) => {
        const cls = classes.find((cls) => cls.id === s.classId);
        return submissionRateForSession(s, cls, feedback);
      }),
    );
    const classAchievements = activeClasses.map((cls) => {
      const classSessions = sessions.filter((s) => s.classId === cls.id);
      return iloAchievementForClass(classSessions, results);
    });
    const ilo = averageRate(classAchievements);
    return { active, submission, ilo };
  }, [feedback, sessions, classes, activeClasses, results]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Workspace overview
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your curriculum and launch coordinated sessions.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Submission rate"
          value={`${stats.submission}%`}
          hint="Average across sessions"
        />
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="ILO achievement"
          value={`${stats.ilo}%`}
          hint="Overall achievement rate"
        />
        <KpiCard
          icon={<GraduationCap className="h-4 w-4" />}
          label="Active classes"
          value={activeClasses.length.toString()}
        />
        <KpiCard
          icon={<Database className="h-4 w-4" />}
          label="Active sessions"
          value={stats.active.toString()}
        />
      </div>

      {/* Hub + activity feed */}
      <div className="grid min-h-0 min-w-0 flex-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <CourseManagementHub />
        <ActivityFeed />
      </div>

      {/* Cross-class creator */}
      <CrossClassSessionCreator />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/60 bg-card/70 backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
          <CardContent className="p-6">
            <Skeleton className="mb-2 h-5 w-44" />
            <Skeleton className="mb-6 h-3 w-56" />
            <Skeleton className="mb-4 h-4 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mb-3 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
          <CardContent className="p-6">
            <Skeleton className="mb-2 h-5 w-32" />
            <Skeleton className="mb-6 h-3 w-40" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="mt-0.5 h-7 w-7 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardContent className="p-6">
          <Skeleton className="mb-2 h-5 w-48" />
          <Skeleton className="mb-6 h-3 w-64" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}


