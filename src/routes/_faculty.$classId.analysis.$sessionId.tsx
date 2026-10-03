import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PlayCircle, Printer, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ModelLoaderOverlay,
  AnalysisTriggerModal,
  SessionFeedbackModal,
  BulkFeedbackImportModal,
} from "@/components/analysis";
import { KpiCardSkeleton, ChartCardSkeleton } from "@/components/skeletons";
import { cn, friendlyError } from "@/lib/hooks/utils";
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
import type { ChartId, FeedbackOpenState } from "@/components/faculty/charts";
import { runAnalysisPipeline, fetchComputedResult } from "@/lib/algorithm/pipeline";
import type { DiagnosticRecord } from "@/lib/algorithm/types";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { useClassStore } from "@/lib/stores/classStore";
import { useCourseStore } from "@/lib/stores/courseStore";
import { useAnalysisStore } from "@/lib/stores/analysisStore";
import type { LoadProgress } from "@/lib/algorithm/models/distilXlmr";
import {
  iloAchievementForSession,
  studentSubmissionsForSession,
  submissionRateForSession,
} from "@/lib/hooks/metrics";
import { computeIloStatuses } from "@/lib/hooks/iloStatus";
import type { AnalysisResult, DistEntry } from "@/lib/types/types";
import { CountBadge } from "@/components/common";
import { KeyMetricsRow } from "@/components/faculty";
import { computeFeedbackStatus } from "@/lib/services/feedbackStatusService";
import { SAMPLE_TUTORIAL_CSV } from "@/lib/tutorial/sampleTutorialData";
import { useTutorialStore } from "@/lib/tutorial/tutorialStore";
import { useAuth } from "@/lib/stores/auth";
import { usePrintReport } from "@/lib/hooks/usePrintReport";
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
  const { user } = useAuth();
  const printReport = usePrintReport();
  const {
    sessions,
    getClass,
    studentCountForClass,
    refreshStudents,
    refreshSessions,
    activeTutorialClassIds,
  } = useClassStore();
  const session = sessions.find((s) => s.id === sessionId);
  const { feedback, fetchFeedback } = useFeedbackStore();
  const { results: analysisResults, set: setAnalysisResult } = useAnalysisStore();
  const [loading, setLoading] = useState(analysisResults[sessionId] == null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(analysisResults[sessionId] ?? null);
  const [inferenceProgress, setInferenceProgress] = useState<{
    current: number;
    total: number;
    text: string;
  } | null>(null);
  const [loadProgress, setLoadProgress] = useState<LoadProgress>({
    status: "done",
    progress: 100,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [feedbackModalState, setFeedbackModalState] = useState<{
    isOpen: boolean;
    categoryFilter: { title: string; feedbackTexts?: string[] } | null;
  }>({ isOpen: false, categoryFilter: null });
  const [feedbackOpen, setFeedbackOpen] = useState<FeedbackOpenState>({ status: "idle" });

  const {
    isActive: tutorialActive,
    step: tutorialStep,
    next: tutorialNext,
    advanceIfStep,
    setSpotlightAnchor,
  } = useTutorialStore();

  // Track cancellation to prevent error toasts when worker is terminated.
  const isCancelledRef = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    let unsubInference: (() => void) | undefined;
    let unsubLoad: (() => void) | undefined;
    import("@/lib/ml/mlWorkerStore").then(
      ({ setInferenceProgressListener, setLoadProgressListener }) => {
        if (!active) return;
        unsubInference = setInferenceProgressListener((payload) => {
          setInferenceProgress(payload);
        });
        unsubLoad = setLoadProgressListener((data) => {
          setLoadProgress(data);
        });
      },
    );
    return () => {
      active = false;
      unsubInference?.();
      unsubLoad?.();
    };
  }, []);

  // Eagerly preload the model so the engine is warm when analysis runs.
  useEffect(() => {
    let cancelled = false;
    import("@/lib/ml/mlWorkerStore")
      .then(({ getMLWorkerAsync }) => getMLWorkerAsync())
      .then(({ api }) => {
        if (!cancelled)
          api.preloadModel().catch((err) => console.warn("[analysis] Model preload failed:", err));
      })
      .catch((err) => console.warn("[analysis] Failed to start model preload:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const resultsRef = React.useRef(analysisResults);
  resultsRef.current = analysisResults;

  useEffect(() => {
    const cached = resultsRef.current[sessionId];
    setResult(cached ?? null);
    setLoading(cached == null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    async function loadInitial() {
      if (!resultsRef.current[sessionId]) {
        setLoading(true);
      }
      try {
        const data = await fetchComputedResult(sessionId);
        if (active) {
          setResult(data);
        }
        // Fetch fresh feedback for verification.
        await fetchFeedback(sessionId);
        // Load student enrollment count.
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
    abortRef.current?.abort();
    const { terminateMLWorker } = await import("@/lib/ml/mlWorkerStore");
    terminateMLWorker();
    setIsAnalyzing(false);
    toast.success("Analysis cancelled.");
  };

  // Remember the selection so "Retry" re-runs the same request.
  const pendingOpenRef = React.useRef<{ chartId: ChartId; entry: DistEntry } | null>(null);

  const handleOpenFeedback = async (chartId: ChartId, entry: DistEntry) => {
    if (
      tutorialActive &&
      (tutorialStep?.id === "step-results-aspect-category" ||
        tutorialStep?.id === "step-results-aspect-all-feedback") &&
      chartId !== "aspect"
    ) {
      return;
    }
    pendingOpenRef.current = { chartId, entry };
    setFeedbackOpen({ status: "opening", chartId });
    try {
      // Re-fetch so network failures surface before opening.
      await fetchFeedback(sessionId);
      setFeedbackOpen({ status: "idle" });
      setFeedbackModalState({
        isOpen: true,
        categoryFilter: { title: entry.label, feedbackTexts: entry.feedbackTexts },
      });
    } catch (err) {
      setFeedbackOpen({
        status: "error",
        chartId,
        error: friendlyError(err, "Couldn't open feedback."),
      });
    }
  };

  const handleCancelOpen = () => setFeedbackOpen({ status: "idle" });

  const handleRetryOpen = () => {
    const pending = pendingOpenRef.current;
    if (pending) void handleOpenFeedback(pending.chartId, pending.entry);
  };

  const handleTrigger = async () => {
    if (!session) return;
    const sessionFeedback = feedback.filter((f) => f.sessionId === session.id);
    if (sessionFeedback.length === 0) {
      toast.warning("No student feedback yet — add feedback before running analysis.");
      return;
    }
    const wasCancelled = isCancelledRef.current;
    setIsAnalyzing(true);
    isCancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setInferenceProgress(null);
    // Reset progress only if interrupted or incomplete.
    setLoadProgress((prev) =>
      wasCancelled || prev.progress !== 100
        ? { status: "progress", progress: 0, phase: "download" }
        : prev,
    );
    try {
      const data = await runAnalysisPipeline(session.id, undefined, controller.signal);
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

  // Tour bridges.
  // step-analysis-import-btn: user clicks the import button → bulkImportOpen becomes true → advance.
  useEffect(() => {
    if (!tutorialActive || !bulkImportOpen) return;
    if (tutorialStep?.id === "step-analysis-import-btn") advanceIfStep("step-analysis-import-btn");
  }, [tutorialActive, bulkImportOpen, tutorialStep?.id, advanceIfStep]);

  useEffect(() => {
    if (!tutorialActive || !modalOpen) return;
    if (tutorialStep?.id === "step-analysis-trigger") advanceIfStep("step-analysis-trigger");
  }, [tutorialActive, modalOpen, tutorialStep?.id, advanceIfStep]);

  const wasAnalyzingRef = React.useRef(false);
  useEffect(() => {
    const wasAnalyzing = wasAnalyzingRef.current;
    wasAnalyzingRef.current = isAnalyzing;
    if (!tutorialActive) return;
    if (isAnalyzing && !wasAnalyzing) {
      // step-analysis-confirm: the confirmation button's onClick calls onConfirm,
      // so the false→true edge means the analysis actually started.
      if (tutorialStep?.id === "step-analysis-confirm") advanceIfStep("step-analysis-confirm");
      // Already on ml-progress: wait for completion.
      return;
    }
    if (!isAnalyzing && wasAnalyzing && tutorialStep?.id === "step-ml-progress") {
      advanceIfStep("step-ml-progress");
    }
  }, [isAnalyzing, tutorialActive, tutorialStep?.id, advanceIfStep]);

  // step-results-aspect-category: a category click opens the modal with a filter → advance.
  useEffect(() => {
    if (!tutorialActive || !feedbackModalState.isOpen || !feedbackModalState.categoryFilter) return;
    if (tutorialStep?.id === "step-results-aspect-category") {
      advanceIfStep("step-results-aspect-category");
    }
  }, [
    tutorialActive,
    feedbackModalState.isOpen,
    feedbackModalState.categoryFilter,
    tutorialStep?.id,
    advanceIfStep,
  ]);

  // step-results-aspect-all-feedback: closing the modal finishes the step.
  const wasFeedbackOpenRef = React.useRef(false);
  useEffect(() => {
    const wasOpen = wasFeedbackOpenRef.current;
    wasFeedbackOpenRef.current = feedbackModalState.isOpen;
    if (!tutorialActive) return;
    if (
      !feedbackModalState.isOpen &&
      wasOpen &&
      tutorialStep?.id === "step-results-aspect-all-feedback"
    ) {
      advanceIfStep("step-results-aspect-all-feedback");
    }
  }, [tutorialActive, feedbackModalState.isOpen, tutorialStep?.id, advanceIfStep]);

  // Pills per feedback for the modal, keyed by id.
  const diagnosticsByFeedbackId = useMemo(() => {
    const map = new Map<string, DiagnosticRecord>();
    for (const d of result?.diagnostics ?? []) {
      if (d.feedbackId) map.set(d.feedbackId, d);
    }
    return map;
  }, [result]);

  if (!session) return null;

  // State machine values
  const sessionFeedback = feedback.filter((f) => f.sessionId === sessionId);
  const feedbackCount = sessionFeedback.length;
  const cls = getClass(classId);
  // One clock for both the printed header and the exported filename.
  const printDate = new Date();
  const printedLabel = printDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const printTitle = [
    "Feeana",
    cls ? `${cls.courseCode} ${cls.section}` : null,
    session.topic,
    compactTimestamp(printDate),
  ]
    .filter(Boolean)
    .join(" - ");
  // The sample preset is only offered inside the tour's own sandbox session.
  const isTutorialSession = !!classId && activeTutorialClassIds.includes(classId);
  const studentCount = classId ? studentCountForClass(classId) : 0;
  const lastAnalyzedAt = session?.last_analyzed_at ?? null;

  // Feedback analysis status
  const feedbackStatus = computeFeedbackStatus(session, feedback);
  const newFeedbackCount = feedbackStatus.newCount;

  const submissionRate = submissionRateForSession(session, cls, feedback);
  const studentSubmissionCount = studentSubmissionsForSession(session, feedback).length;
  const iloRate = result ? iloAchievementForSession(session, { [session.id]: result }) : 100;

  return (
    <div className="space-y-8">
      <PrintHeader
        topic={session.topic}
        courseLine={cls ? `${cls.courseCode} · ${cls.section}` : "Class analysis"}
        facultyName={user?.name}
        responseCount={feedbackCount}
        printedLabel={printedLabel}
      />
      {/* Replaced on paper by PrintHeader; hiding the wrapper covers the back link,
          the title block, and every action button in one place. */}
      <div className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2"
          data-tutorial="analysis-back-to-class-btn"
        >
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
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setBulkImportOpen(true)}
              disabled={loading || isAnalyzing}
              data-tutorial="analysis-import-btn"
            >
              <Upload className="h-4 w-4" />
              Import feedback
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setFeedbackModalState({ isOpen: true, categoryFilter: null })}
              disabled={loading}
            >
              View feedback
            </Button>
            <div className="relative">
              <Button
                size="lg"
                onClick={() => setModalOpen(true)}
                disabled={loading || isAnalyzing}
                data-tutorial="analysis-trigger-btn"
              >
                <PlayCircle className="h-4 w-4" />
                {result ? "Re-run analysis" : "Trigger analysis"}
              </Button>
              <CountBadge count={newFeedbackCount} />
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => printReport(printTitle)}
              disabled={loading || isAnalyzing || !result}
            >
              <Printer className="h-4 w-4" />
              Export report
            </Button>
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
              <div data-tutorial="analysis-kpi-summary">
                <KeyMetricsRow
                  submissionRate={submissionRate}
                  iloRate={iloRate}
                  submissionHint="This session"
                  iloHint="This session"
                />
              </div>
              <Results
                result={result}
                onSelectCategory={handleOpenFeedback}
                opening={feedbackOpen}
                onCancelOpen={handleCancelOpen}
                onRetryOpen={handleRetryOpen}
              />
            </>
          )}
        </>
      )}

      <ModelLoaderOverlay
        isVisible={isAnalyzing}
        loadProgress={loadProgress}
        inferenceProgress={inferenceProgress}
        onCancel={handleCancel}
        dataTutorial="analysis-ml-progress"
      />

      <AnalysisTriggerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleTrigger}
        feedbackCount={feedbackCount}
        studentSubmissionCount={studentSubmissionCount}
        studentCount={studentCount}
        lastAnalyzedAt={lastAnalyzedAt}
        newFeedbackCount={newFeedbackCount}
      />

      <SessionFeedbackModal
        isOpen={feedbackModalState.isOpen}
        onClose={() => setFeedbackModalState((s) => ({ ...s, isOpen: false }))}
        sessionFeedback={sessionFeedback}
        categoryFilter={feedbackModalState.categoryFilter}
        diagnosticsByFeedbackId={diagnosticsByFeedbackId}
      />

      <BulkFeedbackImportModal
        isOpen={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        sessionId={sessionId}
        existingTexts={sessionFeedback.map((f) => f.rawText)}
        studentCount={studentCount}
        onImported={() => {
          void fetchFeedback(sessionId);
          // step-analysis-sample: advance only once the batch is actually saved.
          if (tutorialActive && tutorialStep?.id === "step-analysis-sample") {
            advanceIfStep("step-analysis-sample");
          }
        }}
        loadSample={isTutorialSession ? () => SAMPLE_TUTORIAL_CSV : undefined}
        onSampleLoaded={() => {
          // Move the spotlight onto the Import button once the preset is staged.
          if (tutorialActive && tutorialStep?.id === "step-analysis-sample") {
            setSpotlightAnchor("analysis-import-confirm");
          }
        }}
      />
    </div>
  );
}

/** `YYYYMMDDHHMM`, local time, for a sortable filename-safe stamp. */
function compactTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function PrintHeader({
  topic,
  courseLine,
  facultyName,
  responseCount,
  printedLabel,
}: {
  topic: string;
  courseLine: string;
  facultyName?: string;
  responseCount: number;
  printedLabel: string;
}) {
  return (
    <div className="hidden border-b border-border pb-4 print:block">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Feeana — Pedagogical Feedback Analysis Report
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{topic}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {courseLine}
            {facultyName ? ` — Faculty: ${facultyName}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p>Printed: {printedLabel}</p>
          <p>{responseCount} student responses</p>
          <p className="print:block hidden">Student quotes are omitted; view them in Feeana.</p>
        </div>
      </div>
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
            Start the analysis to see aspects, issues, sentiment, ILO alignment, and actionable
            teaching suggestions.
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
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <ChartCardSkeleton height="h-64" />
        </div>
        <div className="lg:col-span-6">
          <ChartCardSkeleton height="h-64" />
        </div>
        <div className="lg:col-span-4">
          <ChartCardSkeleton height="h-64" />
        </div>
        <div className="lg:col-span-4">
          <ChartCardSkeleton height="h-64" />
        </div>
        <div className="lg:col-span-4">
          <ChartCardSkeleton height="h-64" />
        </div>
        <div className="lg:col-span-12">
          <ChartCardSkeleton height="h-48" />
        </div>
        <div className="lg:col-span-12">
          <ChartCardSkeleton height="h-72" />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-xs font-semibold uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function Results({
  result,
  onSelectCategory,
  opening,
  onCancelOpen,
  onRetryOpen,
}: {
  result: AnalysisResult;
  onSelectCategory: (chartId: ChartId, entry: DistEntry) => void;
  opening: FeedbackOpenState;
  onCancelOpen: () => void;
  onRetryOpen: () => void;
}) {
  const { sessionId } = Route.useParams();
  const { sessions } = useClassStore();
  const session = sessions.find((s) => s.id === sessionId);
  const { feedback } = useFeedbackStore();
  const { ilos } = useCourseStore();
  const feedbackById = useMemo(() => new Map(feedback.map((f) => [f.id, f])), [feedback]);
  const openForChart = (id: ChartId) =>
    opening.status !== "idle" && opening.chartId === id ? opening : null;
  if (!session) return null;
  const iloStatuses = computeIloStatuses(session, result, feedback, ilos);

  const uncategorizedCount =
    result.issueDist.find((e) => e.label.toLowerCase() === "uncategorized")?.value ?? 0;

  const uncategorizedTexts = [
    ...new Set([
      ...(result.aspectDist.find((e) => e.label === "Uncategorized")?.feedbackTexts ?? []),
      ...(result.issueDist.find((e) => e.label === "Uncategorized")?.feedbackTexts ?? []),
      ...(result.rbtDist.find((e) => e.label === "Uncategorized")?.feedbackTexts ?? []),
      ...(result.cltDist.find((e) => e.label === "Uncategorized")?.feedbackTexts ?? []),
    ]),
  ];

  const aspectCount = result.aspectDist.filter((e) => e.label !== "Uncategorized").length;
  const issueCount = result.issueDist.filter(
    (e) => e.label.toLowerCase() !== "uncategorized",
  ).length;
  const distHeight = Math.max(220, Math.max(aspectCount, issueCount) * 32);

  return (
    <div className="space-y-8">
      <section aria-label="What students wrote" className="space-y-4">
        <SectionHeading>What students wrote</SectionHeading>
        <div className="grid gap-4 lg:grid-cols-12 print:block print:space-y-4">
          <div className="lg:col-span-6" data-tutorial="analysis-aspect-chart">
            <AspectDistChart
              data={result.aspectDist}
              totalFeedback={result.totalFeedback}
              height={distHeight}
              onSelectCategory={(entry) => onSelectCategory("aspect", entry)}
              opening={openForChart("aspect")}
              onCancelOpen={onCancelOpen}
              onRetryOpen={onRetryOpen}
            />
          </div>

          {/* Break 1: Issue and Polarity move to page 2. The wrapper carries no
              data-tutorial anchor so anchors remain on the child elements. */}
          <div className="contents print:block print:break-before-page print:space-y-4">
            <div className="lg:col-span-6" data-tutorial="analysis-issue-chart">
              <IssueDistChart
                data={result.issueDist}
                height={distHeight}
                onSelectCategory={(entry) => onSelectCategory("issue", entry)}
                opening={openForChart("issue")}
                onCancelOpen={onCancelOpen}
                onRetryOpen={onRetryOpen}
              />
            </div>
            <div className="lg:col-span-4" data-tutorial="analysis-polarity-chart">
              <PolarityDistChart
                data={result.polarityDist}
                onSelectCategory={(entry) => onSelectCategory("polarity", entry)}
                opening={openForChart("polarity")}
                onCancelOpen={onCancelOpen}
                onRetryOpen={onRetryOpen}
              />
            </div>
          </div>

          {/* Break 2: RBT and CLT move to page 3. */}
          <div
            className="grid grid-cols-2 gap-4 lg:col-span-8 print:break-before-page"
            data-tutorial="analysis-cognitive-charts"
          >
            <RbtDistChart
              data={result.rbtDist}
              onSelectCategory={(entry) => onSelectCategory("rbt", entry)}
              opening={openForChart("rbt")}
              onCancelOpen={onCancelOpen}
              onRetryOpen={onRetryOpen}
            />
            <CltDistChart
              data={result.cltDist}
              onSelectCategory={(entry) => onSelectCategory("clt", entry)}
              opening={openForChart("clt")}
              onCancelOpen={onCancelOpen}
              onRetryOpen={onRetryOpen}
            />
          </div>
          <div className="lg:col-span-12" data-tutorial="analysis-uncategorized-notice">
            <UncategorizedNotice
              count={uncategorizedCount}
              totalFeedback={result.totalFeedback}
              feedbackTexts={uncategorizedTexts}
            />
          </div>
        </div>
      </section>

      <section aria-label="Goal attainment" className="space-y-4" data-tutorial="analysis-ilo-gaps">
        <SectionHeading className="print:break-before-page">Goal attainment</SectionHeading>
        <IloGapCard statuses={iloStatuses} gaps={result.gaps} feedback={feedbackById} />
      </section>

      <section
        aria-label="Recommended next actions"
        className="space-y-4"
        data-tutorial="analysis-recommendations"
      >
        <SectionHeading className="print:break-before-page">
          Recommended next actions
        </SectionHeading>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <RecommendationCuesCard recommendations={result.recommendations} ilos={ilos} />
          <WarningsCard data={result.warnings} />
        </div>
      </section>
    </div>
  );
}
