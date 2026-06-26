import { createFileRoute, Link, notFound, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ClassDetailsCard, ConfirmationDialog, ClassStudentsTab, KeyMetricsRow, SessionCreator, SessionCard as FacultySessionCard } from "@/components/faculty";
import { TrendLineCard, TrendBarCard } from "@/components/faculty/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAnalysisStore } from "@/lib/stores/analysisStore";
import { useClassStore } from "@/lib/stores/classStore";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { supabase } from "@/lib/db/supabase";
import { fromDbFeedback } from "@/lib/services/feedbackService";
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
  const [isDataFresh, setIsDataFresh] = useState(false);

  const cls = getClass(classId);
  const sessions = sessionsForClass(classId);

  const sessionIdsKey = useMemo(() => sessions.map((s) => s.id).join(","), [sessions]);

  useEffect(() => {
    const promises: Promise<any>[] = [];

    if (classId) {
      promises.push(fetchFeedbackByClass(classId));
      refreshStudents(classId);
    }

    if (sessionIdsKey) {
      const ids = sessionIdsKey.split(",").filter(Boolean);
      if (ids.length > 0) {
        promises.push(fetchForSessions(ids));
      }
    }

    if (promises.length > 0) {
      setIsDataFresh(false);
      Promise.all(promises).finally(() => setIsDataFresh(true));
    }
  }, [classId, sessionIdsKey, fetchFeedbackByClass, refreshStudents, fetchForSessions]);

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
  const iloRate = useMemo(
    () => computeClassIloAchievement(sessions, results),
    [sessions, results],
  );
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
      {isDataFresh ? (
        <>
          <KeyMetricsRow
            submissionRate={submissionRate}
            iloRate={iloRate}
            submissionHint="Across sessions in this class"
            iloHint="Across sessions in this class"
          />

          <TrendLineCard trend={trend} />

          <TrendBarCard trend={trend} />

          {/* Trend interpretation */}
          {/* <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
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
          </Card> */}
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
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
          <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
            <CardContent className="p-6">
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
            <CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-1 h-3 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </>
      )}

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
        description={`Archive the "${cls.courseCode} · ${cls.section}" class? This class will be hidden from your dashboard but can be restored later.`}
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
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
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-2">
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


