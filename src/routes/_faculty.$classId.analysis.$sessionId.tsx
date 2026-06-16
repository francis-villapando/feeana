import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  PlayCircle,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RecommendationParagraph, ModelLoaderOverlay, chartTooltipProps, ChartTooltipContent, AnalysisTriggerModal } from "@/components/analysis";
import { runAnalysis, fetchAnalysisResult } from "@/lib/orchestration/analysis";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { useClassStore } from "@/lib/stores/classStore";
import { useCourseStore } from "@/lib/stores/courseStore";
import { computeIloStatuses } from "@/lib/hooks/iloStatus";
import type { AnalysisResult } from "@/lib/types/types";
import { CountBadge } from "@/components/common";
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

const POLARITY_COLORS: Record<string, string> = {
  Positive: "var(--color-chart-1)",
  Neutral: "var(--color-chart-3)",
  Negative: "var(--color-chart-4)",
};

function AnalysisPage() {
  const { classId, sessionId } = Route.useParams();
  const { sessions, getClass, studentCountForClass, refreshStudents, refreshSessions } = useClassStore();
  const session = sessions.find((s) => s.id === sessionId);
  const { feedback, fetchFeedback } = useFeedbackStore();

  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [inferenceProgress, setInferenceProgress] = useState<{ current: number; total: number; text: string } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(100);
  const [modalOpen, setModalOpen] = useState(false);

  // Track cancellation to prevent error toasts when worker is terminated
  const isCancelledRef = React.useRef(false);

  useEffect(() => {
    import("@/lib/ml/mlWorkerStore").then(({ setInferenceProgressListener, setDownloadProgressListener }) => {
      setInferenceProgressListener((payload) => {
        setInferenceProgress(payload);
      });
      setDownloadProgressListener((data) => {
        setDownloadProgress(data.status === 'done' ? 100 : (data.progress ?? 0));
      });
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    async function loadInitial() {
      setLoading(true);
      try {
        const data = await fetchAnalysisResult(sessionId);
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
    setDownloadProgress(0);
    try {
      const data = await runAnalysis(session.id);
      if (!isCancelledRef.current) {
        setResult(data);
        if (classId) {
          await refreshSessions(classId);
        }
        toast.success("Analysis complete");
      }
    } catch (err) {
      if (!isCancelledRef.current) {
        toast.error(err instanceof Error ? err.message : "Analysis failed.");
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

      {!result && !loading && !isAnalyzing && <EmptyState onTrigger={() => setModalOpen(true)} />}
      {loading && <LoadingState />}
      {result && <Results result={result} />}

      <ModelLoaderOverlay
        isVisible={isAnalyzing}
        downloadProgress={downloadProgress}
        inferenceProgress={inferenceProgress}
        statusText={inferenceProgress ? "Processing feedback entries..." : "Initializing Machine Learning Engine..."}
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
    <div className="grid gap-4 lg:grid-cols-3">
      <Skeleton className="h-64 lg:col-span-2" />
      <Skeleton className="h-64" />
      <Skeleton className="h-48 lg:col-span-3" />
      <Skeleton className="h-72 lg:col-span-3" />
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
  const sortedRecs = [...result.recommendations].sort((a, b) => b.priority - a.priority);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Aspect distribution</CardTitle>
          <CardDescription>
            What students talked about across {result.totalFeedback} responses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(220, result.aspectDist.length * 32)}>
            <BarChart data={result.aspectDist} layout="vertical">
              <CartesianGrid stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" domain={[0, 'dataMax']} allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis
                type="category"
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                width={170}
              />
              <Tooltip {...chartTooltipProps} content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">Polarity</CardTitle>
          <CardDescription>Sentiment split</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={result.polarityDist}
                dataKey="value"
                nameKey="label"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
              >
                {result.polarityDist.map((entry) => (
                  <Cell
                    key={entry.label}
                    fill={POLARITY_COLORS[entry.label] ?? "var(--color-chart-2)"}
                  />
                ))}
              </Pie>
              <Tooltip {...chartTooltipProps} content={<ChartTooltipContent colorMap={POLARITY_COLORS} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Issue distribution</CardTitle>
          <CardDescription>Specific concerns extracted via PID-ABSA.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(220, result.issueDist.length * 32)}>
            <BarChart data={result.issueDist} layout="vertical">
              <CartesianGrid stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" domain={[0, 'dataMax']} allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis
                type="category"
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                width={170}
              />
              <Tooltip {...chartTooltipProps} content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" /> ILO gap analysis
          </CardTitle>
          <CardDescription>
            Status of every intended learning outcome for this course.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {iloStatuses.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
              No ILOs defined for this course.
            </p>
          ) : (
            iloStatuses.map(({ ilo, achieved }) => (
              <div
                key={ilo.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
              >
                {achieved ? (
                  <CheckCircle2 className="self-center h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="self-center h-5 w-5 shrink-0 text-destructive" />
                )}
                <p className="flex-1 text-sm leading-relaxed">{ilo.statement}</p>
                <Badge
                  variant="default"
                  className="self-center shrink-0 text-[9px] px-1 h-3.5 font-normal uppercase tracking-tighter"
                >
                  {ilo.bloomLevel}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-primary" /> Recommendation cues
          </CardTitle>
          <CardDescription>
            Hover the highlighted terms to see how each maps across pedagogical frameworks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {sortedRecs.map((rec, i) => (
              <RecommendationParagraph key={rec.id} rec={rec} index={i} ilos={ilos} />
            ))}
          </ol>
        </CardContent>
      </Card>

      {result.warnings.length > 0 && (
        <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Warnings
            </CardTitle>
            <CardDescription>
              Issues detected below the recommendation threshold.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...result.warnings].sort((a, b) => b.count - a.count).map(w => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3"
              >
                <p className="text-sm leading-relaxed">{w.issue}</p>
                <Badge
                  variant="default"
                  className="shrink-0 text-[9px] px-1 h-3.5 font-normal"
                >
                  {w.count}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
