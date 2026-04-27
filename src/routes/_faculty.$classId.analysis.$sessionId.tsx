import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RecommendationParagraph } from "@/components/analysis/RecommendationParagraph";
import { runAnalysis } from "@/lib/analysis";
import { useAnalysisStore } from "@/lib/analysisStore";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { useClassStore } from "@/lib/classStore";
import { useCourseStore } from "@/lib/courseStore";
import { computeIloStatuses } from "@/lib/iloStatus";
import type { AnalysisResult } from "@/lib/types";

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
  const { sessions } = useClassStore();
  const session = sessions.find((s) => s.id === sessionId);
  const { get, set } = useAnalysisStore();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const cached = get(sessionId);
    if (cached) setResult(cached);
  }, [get, sessionId]);

  const handleTrigger = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await runAnalysis(session.id);
      setResult(data);
      set(session.id, data);
      toast.success("Analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

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
          <Button size="lg" onClick={handleTrigger} disabled={loading}>
            <PlayCircle className="h-4 w-4" />
            {result ? "Re-run analysis" : "Trigger analysis"}
          </Button>
        </div>
      </div>

      {!result && !loading && <EmptyState onTrigger={handleTrigger} />}
      {loading && <LoadingState />}
      {result && <Results result={result} />}
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
            What students talked about across {result.totalFeedback} responses (
            {result.pedagogicalCount} pedagogical).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={result.aspectDist}>
              <CartesianGrid stroke="oklch(1 0 0 / 8%)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip
                cursor={{ fill: "oklch(1 0 0 / 5%)" }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">Polarity</CardTitle>
          <CardDescription>Sentiment split.</CardDescription>
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
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Issue distribution</CardTitle>
          <CardDescription>Specific concerns extracted via ABSA.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(220, result.issueDist.length * 32)}>
            <BarChart data={result.issueDist} layout="vertical">
              <CartesianGrid stroke="oklch(1 0 0 / 8%)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis
                type="category"
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                width={170}
              />
              <Tooltip
                cursor={{ fill: "oklch(1 0 0 / 5%)" }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-card/70 backdrop-blur-xl lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" /> ILO Gap Analysis
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
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                )}
                <p className="text-sm leading-relaxed">{ilo.statement}</p>
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
    </div>
  );
}
