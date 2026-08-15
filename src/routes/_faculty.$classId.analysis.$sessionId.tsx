import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PlayCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelLoaderOverlay, AnalysisTriggerModal } from "@/components/analysis";
import { KpiCardSkeleton, ChartCardSkeleton } from "@/components/skeletons";
import { friendlyError } from "@/lib/hooks/utils";
import {
  AspectDistChart,
  PolarityDistChart,
  IssueDistChart,
  RbtDistChart,
  CltDistChart,
  UncategorizedNotice,
  IloGapCard,
  RecommendationCuesCard,
  WarningsCard,
} from "@/components/faculty/charts";
import { runAnalysisPipeline, fetchComputedResult } from "@/lib/algorithm/pipeline";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { useClassStore } from "@/lib/stores/classStore";
import { useCourseStore } from "@/lib/stores/courseStore";
import { useAnalysisStore } from "@/lib/stores/analysisStore";
import { iloAchievementForSession, submissionRateForSession } from "@/lib/hooks/metrics";
import { computeIloStatuses } from "@/lib/hooks/iloStatus";
import type { AnalysisResult } from "@/lib/types/types";
import { CountBadge } from "@/components/common";
import { KeyMetricsRow } from "@/components/faculty";
import { computeFeedbackStatus } from "@/lib/services/feedbackStatusService";
import React from "react";

export const Route = createFileRoute("/_faculty/$classId/analysis/$sessionId")({
  loader: async ({ params }) => {
    return { sessionId: params.sessionId, classId: params.classId };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `Analysis — Feeana` : "Analysis — Feeana",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Session not found</h1>
      <Button asChild variant="ghost" className="mt-4">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </Button>
    </div>
  ),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { classId, sessionId } = Route.useParams();
  const { sessions, getClass, studentCountForClass, refreshStudents, refreshSessions } =
    useClassStore();
  const session = sessions.find((s) => s.id === sessionId);
  const { feedback, fetchFeedback } = useFeedbackStore();
  const { set: setAnalysisResult } = useAnalysisStore();
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [inferenceProgress, setInferenceProgress] = useState<{
    current: number;
    total: number;
    text: string;
  } | null>(null);
  const [loadProgress, setLoadProgress] = useState(100);
  const [modalOpen, setModalOpen] = useState(false);

  // Track cancellation to prevent error toasts when worker is terminated
  const isCancelledRef = React.useRef(false);

  useEffect(() => {
    import("@/lib/ml/mlWorkerStore").then(
      ({ setInferenceProgressListener, setLoadProgressListener }) => {
        setInferenceProgressListener((payload) => {
          setInferenceProgress(payload);
        });
        setLoadProgressListener((data) => {
          setLoadProgress(data.status === "done" ? 100 : (data.progress ?? 0));
        });
      },
    );
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    async function loadInitial() {
      setLoading(true);
      try {
        const data = await fetchComputedResult(sessionId);
        if (active) {
          setResult(data);
        }
        // Fetch fresh feedback entries for count verification
        await fetchFeedback(sessionId);
        // Load student enrollment count
        if (classId) {
          await refreshStudents(classId);
        }
      } catch (err) {
        console.error("Failed to load initial analysis from database:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      active = false;
    };
  }, [sessionId, classId, fetchFeedback, refreshStudents]);

  const handleCancel = async () => {
    isCancelledRef.current = true;
    const { terminateMLWorker } = await import("@/lib/ml/mlWorkerStore");
    terminateMLWorker();
    setIsAnalyzing(false);
    toast.success("Analysis cancelled.");
  };

  const handleTrigger = async () => {
    if (!session) return;
    setIsAnalyzing(true);
    isCancelledRef.current = false;
    setInferenceProgress(null);
    setLoadProgress(0);
    try {
      const data = await runAnalysisPipeline(session.id);
      if (!isCancelledRef.current) {
        setResult(data);
        setAnalysisResult(session.id, data);
        if (classId) {
          await refreshSessions(classId);
        }
        toast.success("Analysis complete");
      }
    } catch (err) {
      if (!isCancelledRef.current) {
        toast.error(friendlyError(err, "Analysis failed."));
      }
    } finally {
      if (!isCancelledRef.current) {
        setIsAnalyzing(false);
      }
    }
  };

  if (!session) return null;

  // State machine values
  const sessionFeedback = feedback.filter((f) => f.sessionId === sessionId);
  const feedbackCount = sessionFeedback.length;
  const cls = getClass(classId);
  const studentCount = classId ? studentCountForClass(classId) : 0;
  const lastAnalyzedAt = session?.last_analyzed_at ?? null;

  // Feedback analysis status
  const feedbackStatus = computeFeedbackStatus(session, feedback);
  const newFeedbackCount = feedbackStatus.newCount;

  const submissionRate = submissionRateForSession(session, cls, feedback);
  const iloRate = result ? iloAchievementForSession(session, { [session.id]: result }) : 100;

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/$classId" params={{ classId }}>
            <ArrowLeft className="h-4 w-4" /> Back to class
          </Link>
        </Button>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Session analysis
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{session.topic}</h1>
          </div>
          <div className="relative">
            <Button size="lg" onClick={() => setModalOpen(true)} disabled={loading || isAnalyzing}>
              <PlayCircle className="h-4 w-4" />
              {result ? "Re-run analysis" : "Trigger analysis"}
            </Button>
            <CountBadge count={newFeedbackCount} />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {!result && !isAnalyzing && <EmptyState onTrigger={() => setModalOpen(true)} />}
          {result && (
            <>
              <KeyMetricsRow
                submissionRate={submissionRate}
                iloRate={iloRate}
                submissionHint="This session"
                iloHint="This session"
              />
              <Results result={result} />
            </>
          )}
        </>
      )}

      <ModelLoaderOverlay
        isVisible={isAnalyzing}
        loadProgress={loadProgress}
        inferenceProgress={inferenceProgress}
        statusText={
          inferenceProgress
            ? "Processing feedback entries..."
            : "Initializing Machine Learning Engine..."
        }
        onCancel={handleCancel}
      />

      <AnalysisTriggerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleTrigger}
        feedbackCount={feedbackCount}
        studentCount={studentCount}
        lastAnalyzedAt={lastAnalyzedAt}
        newFeedbackCount={newFeedbackCount}
      />
    </div>
  );
}

function EmptyState({ onTrigger }: { onTrigger: () => void }) {
  return (
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <Sparkles className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Analysis not yet triggered</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Trigger the pipeline to see aspect, issue, and polarity distributions, an ILO checklist,
            and theory-grounded teaching recommendations.
          </p>
        </div>
        <Button onClick={onTrigger} size="lg">
          <PlayCircle className="h-4 w-4" /> Trigger analysis
        </Button>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCardSkeleton height="h-64" />
        </div>
        <ChartCardSkeleton height="h-64" />
        <div className="lg:col-span-3">
          <ChartCardSkeleton height="h-48" />
        </div>
        <div className="lg:col-span-3">
          <ChartCardSkeleton height="h-72" />
        </div>
      </div>
    </div>
  );
}

function Results({ result }: { result: AnalysisResult }) {
  const { sessionId } = Route.useParams();
  const { sessions } = useClassStore();
  const session = sessions.find((s) => s.id === sessionId);
  const { feedback } = useFeedbackStore();
  const { ilos } = useCourseStore();
  if (!session) return null;
  const iloStatuses = computeIloStatuses(session, result, feedback, ilos);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <AspectDistChart data={result.aspectDist} totalFeedback={result.totalFeedback} />
      <PolarityDistChart data={result.polarityDist} />
      <IssueDistChart data={result.issueDist} />
      <div className="grid gap-4 lg:grid-cols-2 lg:col-span-3">
        <RbtDistChart data={result.rbtDist} />
        <CltDistChart data={result.cltDist} />
      </div>
      <UncategorizedNotice rbtDist={result.rbtDist} cltDist={result.cltDist} />
      <IloGapCard statuses={iloStatuses} />
      <RecommendationCuesCard recommendations={result.recommendations} ilos={ilos} />
      <WarningsCard data={result.warnings} />
    </div>
  );
}
