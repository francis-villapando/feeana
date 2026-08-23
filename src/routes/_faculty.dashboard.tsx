import { createFileRoute } from "@tanstack/react-router";
import { Database, GraduationCap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { useClassStore } from "@/lib/stores/classStore";
import { useAnalysisStore } from "@/lib/stores/analysisStore";
import {
  computeDashboardSubmissionRate,
  computeDashboardIloAchievement,
} from "@/lib/hooks/metrics";
import { isSessionActive } from "@/lib/utils/sessionStatusUtils";
import { useLiveNow } from "@/lib/hooks/useLiveNow";
import {
  CourseManagementHub,
  ActivityFeed,
  CrossClassSessionCreator,
} from "@/components/faculty/dashboard";
import { KeyMetricsRow, KpiCard } from "@/components/faculty";
import { KpiCardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

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
  const { feedback, fetchFeedbackBySessions } = useFeedbackStore();
  const { activeClasses, sessions, isLoading } = useClassStore();
  const { results, fetchForSessions } = useAnalysisStore();

  const sessionIdsKey = useMemo(() => sessions.map((s) => s.id).join(","), [sessions]);

  const now = useLiveNow();

  const [isDataFresh, setIsDataFresh] = useState(false);

  useEffect(() => {
    const ids = sessionIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) {
      setIsDataFresh(true);
      return;
    }
    setIsDataFresh(false);
    Promise.all([fetchForSessions(ids), fetchFeedbackBySessions(ids)]).finally(() =>
      setIsDataFresh(true),
    );
  }, [sessionIdsKey, fetchForSessions, fetchFeedbackBySessions]);

  const stats = useMemo(() => {
    const activeClassIds = new Set(activeClasses.map((c) => c.id));
    const active = sessions.filter(
      (s) => isSessionActive(s, new Date(now)) && activeClassIds.has(s.classId),
    ).length;
    const submission = computeDashboardSubmissionRate(activeClasses, sessions, feedback);
    const ilo = computeDashboardIloAchievement(activeClasses, sessions, results);
    return { active, submission, ilo };
  }, [feedback, sessions, activeClasses, results, now]);

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
      {isDataFresh ? (
        <KeyMetricsRow
          submissionRate={stats.submission}
          iloRate={stats.ilo}
          submissionHint={
            stats.submission !== null ? "Across all sessions" : "No analyzed sessions"
          }
          iloHint={stats.ilo !== null ? "Across all sessions" : "No analyzed sessions"}
          wide
        >
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
        </KeyMetricsRow>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      )}

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
      <PageHeaderSkeleton />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
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
