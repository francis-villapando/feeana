import { createFileRoute } from "@tanstack/react-router";
import { Activity, Database, GraduationCap, Target, Users } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { useClassStore } from "@/lib/classStore";
import { useAnalysisStore } from "@/lib/analysisStore";
import { averageRate, iloAchievementForClass, iloAchievementForSession, submissionRateForSession } from "@/lib/metrics";
import { CourseManagementHub } from "@/components/dashboard/CourseManagementHub";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { CrossClassSessionCreator } from "@/components/dashboard/CrossClassSessionCreator";

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
  const { activeClasses, sessions, classes } = useClassStore();
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
        const cls = classes.find((c) => c.id === s.classId);
        return submissionRateForSession(s, cls, feedback);
      }),
    );
    const classAchievements = activeClasses.map((c) => {
      const classSessions = sessions.filter((s) => s.classId === c.id);
      return iloAchievementForClass(classSessions, results);
    });
    const ilo = averageRate(classAchievements);
    return { active, submission, ilo };
  }, [feedback, sessions, classes, activeClasses, results]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Workspace overview
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your curriculum and launch coordinated sessions.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
          <Activity className="h-3 w-3" /> Live
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={<Users className="h-4 w-4" />}
          label="Avg submission rate"
          value={`${stats.submission}%`}
        />
        <KpiTile
          icon={<Target className="h-4 w-4" />}
          label="Avg ILO achievement"
          value={`${stats.ilo}%`}
        />
        <KpiTile
          icon={<GraduationCap className="h-4 w-4" />}
          label="Active classes"
          value={activeClasses.length.toString()}
        />
        <KpiTile
          icon={<Database className="h-4 w-4" />}
          label="Active sessions"
          value={stats.active.toString()}
        />
      </div>

      {/* Hub + activity feed */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <CourseManagementHub />
        <ActivityFeed />
      </div>

      {/* Cross-class creator */}
      <CrossClassSessionCreator />
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
