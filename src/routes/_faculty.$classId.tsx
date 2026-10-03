import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft, Loader2, SearchX, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ClassDetailsCard,
  ConfirmationDialog,
  ClassStudentsTab,
  KeyMetricsRow,
  SessionCreator,
  SessionCard as FacultySessionCard,
} from "@/components/faculty";
import { MetricTrendCard, CategoryTrendCard } from "@/components/faculty/charts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCardSkeleton, ChartCardSkeleton } from "@/components/skeletons";
import { friendlyError } from "@/lib/hooks/utils";

import { useAnalysisStore } from "@/lib/stores/analysisStore";
import { useAuth } from "@/lib/stores/auth";
import { useClassStore } from "@/lib/stores/classStore";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { supabase } from "@/lib/db/supabase";
import { fromDbFeedback } from "@/lib/services/feedbackService";
import { useTutorialStore } from "@/lib/tutorial/tutorialStore";
import { createTutorialTrendSessions } from "@/lib/tutorial/sampleTutorialData";
import {
  classTrendData,
  computeClassSubmissionRate,
  computeClassIloAchievement,
} from "@/lib/hooks/metrics";

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
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <SearchX className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Class not found</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            This class may have been archived, deleted, or isn't visible to your account. Check your
            class list on the dashboard, or head back home.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="ghost">
            <Link to="/dashboard">Open dashboard</Link>
          </Button>
          <Button asChild>
            <Link to="/home">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  ),
  component: ClassLayout,
});

function ClassLayout() {
  const { classId } = Route.useParams();
  const {
    getClass,
    sessionsForClass,
    studentCountForClass,
    isLoading,
    archiveClass,
    refreshStudents,
    refreshSessions,
    refreshClasses,
  } = useClassStore();
  const { feedback, fetchFeedbackByClass, insertRealtimeFeedback } = useFeedbackStore();
  const { results, fetchForSessions } = useAnalysisStore();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [isGeneratingTrends, setIsGeneratingTrends] = useState(false);
  const { isActive: tutorialActive, step: tutorialStep, advanceIfStep } = useTutorialStore();

  const cls = getClass(classId);
  const sessions = sessionsForClass(classId);
  const archiveLocked = tutorialActive && tutorialStep?.id === "step-class-details";

  const handleGenerateTrends = async () => {
    if (!cls || sessions.length === 0 || !user || isGeneratingTrends) return;
    setIsGeneratingTrends(true);
    try {
      const baseSession = sessions[0];
      const { session2Id, session3Id } = await createTutorialTrendSessions({
        classId: cls.id,
        baseSession,
        facultyId: user.id,
      });
      await Promise.all([
        refreshClasses(),
        refreshSessions(cls.id),
        fetchFeedbackByClass(cls.id),
        fetchForSessions([session2Id, session3Id]),
      ]);
      toast.success("Generated 2 sample sessions for trend tracking");
      advanceIfStep("step-populate-trends");
    } catch (err) {
      toast.error(friendlyError(err, "Failed to generate sample sessions."));
    } finally {
      setIsGeneratingTrends(false);
    }
  };

  const sessionIdsKey = useMemo(() => sessions.map((s) => s.id).join(","), [sessions]);

  useEffect(() => {
    if (location.pathname.includes("/analysis/")) return;

    if (classId) {
      fetchFeedbackByClass(classId);
      refreshStudents(classId);
    }

    const ids = sessionIdsKey.split(",").filter(Boolean);
    if (ids.length > 0) {
      fetchForSessions(ids);
    }
  }, [
    location.pathname,
    classId,
    sessionIdsKey,
    fetchFeedbackByClass,
    refreshStudents,
    fetchForSessions,
  ]);

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
    () => computeClassSubmissionRate(sessions, cls, feedback),
    [sessions, cls, feedback],
  );
  const iloRate = useMemo(() => computeClassIloAchievement(sessions, results), [sessions, results]);
  const trend = useMemo(
    () => classTrendData(sessions, results, cls, feedback),
    [sessions, results, cls, feedback],
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
    setArchiveError("");
    try {
      await archiveClass(cls.id);
      toast.success("Class archived");
      setArchiveOpen(false);
      navigate({ to: "/home" });
    } catch (err) {
      setArchiveError(friendlyError(err, "Failed to archive"));
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </Button>

      <div data-tutorial="class-overview-section">
        <KeyMetricsRow
          submissionRate={submissionRate}
          iloRate={iloRate}
          submissionHint={
            submissionRate !== null ? "Across sessions in this class" : "No analyzed sessions"
          }
          iloHint={iloRate !== null ? "Across sessions in this class" : "No analyzed sessions"}
        />

        {tutorialActive && tutorialStep?.id === "step-populate-trends" && (
          <Card
            className="mt-6 border-primary/40 bg-primary/5 backdrop-blur-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
            data-tutorial="class-populate-trends-card"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Populate Longitudinal Trend Data
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Generate 2 subsequent analyzed sessions across future dates to visualize metric and
                category progression on the trend charts.
              </p>
            </div>
            <Button
              size="sm"
              disabled={isGeneratingTrends}
              onClick={handleGenerateTrends}
              data-tutorial="class-populate-trends-btn"
              className="shrink-0 gap-2 min-w-[200px]"
            >
              {isGeneratingTrends ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating sessions...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4" />
                  Generate 2 Sample Sessions
                </>
              )}
            </Button>
          </Card>
        )}

        <div className="space-y-6 mt-6" data-tutorial="class-trends">
          <MetricTrendCard trend={trend} />
          <CategoryTrendCard trend={trend} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4 lg:col-start-2 lg:row-start-1">
          <div data-tutorial="class-details-card">
            <ClassDetailsCard
              cls={cls}
              studentCount={studentCountForClass(classId)}
              onCopy={copy}
              archiveDisabled={archiveLocked}
              onArchive={() => {
                setArchiveError("");
                setArchiveOpen(true);
              }}
            />
          </div>

          <div data-tutorial="class-session-creator">
            <SessionCreator classId={cls.id} />
          </div>
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
        description={`Archive the "${cls.courseCode} · ${cls.section}" class? This class will be hidden from your dashboard but can be restored later.`}
        actionType="archive"
        errorMessage={archiveError}
      />
    </div>
  );
}

function SessionsList({ classId }: { classId: string }) {
  const { sessionsForClass } = useClassStore();
  const { activeClassId: tutorialClassId, activeSessionId: tutorialSessionId } = useTutorialStore();
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {sessions.map((s) => (
        <div
          key={s.id}
          data-tutorial={
            classId === tutorialClassId && s.id === tutorialSessionId
              ? "class-session-card"
              : undefined
          }
        >
          <FacultySessionCard session={s} />
        </div>
      ))}
    </div>
  );
}

function ClassLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-24" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton height="h-80" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ChartCardSkeleton height="h-64" />
        <div className="space-y-4">
          <ChartCardSkeleton height="h-48" />
          <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
            <CardContent className="p-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
