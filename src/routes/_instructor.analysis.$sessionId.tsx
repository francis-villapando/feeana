import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Cloud,
  HardDrive,
  Info,
  Lightbulb,
  PlayCircle,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react";
import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { runAnalysis } from "@/lib/analysis";
import { MOCK_ILOS, MOCK_SESSIONS } from "@/lib/mockData";
import type { AnalysisMode, AnalysisResult, Severity, Theory } from "@/lib/types";

export const Route = createFileRoute("/_instructor/analysis/$sessionId")({
  loader: ({ params }) => {
    const session = MOCK_SESSIONS.find((s) => s.id === params.sessionId);
    if (!session) throw notFound();
    return { session };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.session.topic} — Analysis · Feeana`
          : "Analysis — Feeana",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Session not found</h1>
      <Button asChild variant="ghost" className="mt-4">
        <Link to="/dashboard">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
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

const THEORY_LABEL: Record<Theory, string> = {
  RBT: "Revised Bloom's Taxonomy",
  CLT: "Cognitive Load Theory",
  TTI: "Teaching Through Interactions",
};

const SEVERITY_STYLE: Record<Severity, string> = {
  low: "border-primary/30 bg-primary/10 text-primary",
  medium: "border-warning/40 bg-warning/10 text-warning",
  high: "border-destructive/40 bg-destructive/10 text-destructive",
};

function AnalysisPage() {
  const { session } = Route.useLoaderData();
  const linkedIlos = MOCK_ILOS.filter((ilo) => session.iloIds.includes(ilo.id));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleTrigger = async (mode: AnalysisMode) => {
    setDialogOpen(false);
    setLoading(true);
    setResult(null);
    try {
      const data = await runAnalysis(session.id, mode);
      setResult(data);
      toast.success(
        `${mode === "online" ? "Online" : "Offline"} analysis complete`,
      );
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
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Session analysis
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {session.topic}
            </h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {linkedIlos.map((ilo) => (
                <Badge
                  key={ilo.id}
                  variant="outline"
                  className="border-primary/30 text-primary"
                >
                  {ilo.code} · {ilo.bloomLevel}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => setDialogOpen(true)}
            disabled={loading}
          >
            <PlayCircle className="h-4 w-4" />
            {result ? "Re-run analysis" : "Trigger analysis"}
          </Button>
        </div>
      </div>

      {!result && !loading && <EmptyState onTrigger={() => setDialogOpen(true)} />}
      {loading && <LoadingState />}
      {result && <Results result={result} />}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose analysis mode</DialogTitle>
            <DialogDescription>
              Online runs the full XLM-RoBERTa pipeline on the server. Offline
              uses the lightweight on-device model.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              icon={<Cloud className="h-5 w-5" />}
              title="Online (Server)"
              body="Richer cues, higher confidence, deeper theory mapping."
              onClick={() => handleTrigger("online")}
            />
            <ModeCard
              icon={<HardDrive className="h-5 w-5" />}
              title="Offline (Local)"
              body="Lighter subset of recommendations, faster execution."
              onClick={() => handleTrigger("offline")}
            />
          </div>
        </DialogContent>
      </Dialog>
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
            Feeana waits until you're ready. Trigger the pipeline to see aspect,
            issue, and polarity distributions, an ILO gap analysis, and
            theory-grounded teaching cues.
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

function ModeCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-5 text-left transition hover:border-primary/40 hover:bg-card/80"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30 transition group-hover:bg-primary/25">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
    </button>
  );
}

function Results({ result }: { result: AnalysisResult }) {
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
              <XAxis
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
              />
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
              <Bar
                dataKey="value"
                fill="var(--color-primary)"
                radius={[6, 6, 0, 0]}
              />
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
            Expected outcomes vs. actual student experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.gaps.map((gap) => (
            <div
              key={gap.iloId}
              className="grid gap-3 rounded-lg border border-border/60 bg-background/40 p-4 sm:grid-cols-[1fr_auto_1fr]"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Expected · {MOCK_ILOS.find((i) => i.id === gap.iloId)?.code}
                </p>
                <p className="mt-1 text-sm leading-relaxed">{gap.expected}</p>
              </div>
              <div className="flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actual
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase ${SEVERITY_STYLE[gap.severity]}`}
                  >
                    {gap.severity} gap
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {gap.actual}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-primary" /> Recommendation cues
          </CardTitle>
          <CardDescription>
            Hover any cue to inspect the underlying theory and the trigger
            pattern that produced it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.recommendations.map((rec) => (
            <HoverCard key={rec.id} openDelay={120}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3 text-left transition hover:border-primary/40 hover:bg-background/60"
                >
                  <Badge
                    variant="outline"
                    className="mt-0.5 shrink-0 border-primary/40 bg-primary/10 font-mono text-[10px] text-primary"
                  >
                    {rec.theory}
                  </Badge>
                  <span className="text-sm leading-relaxed">{rec.cue}</span>
                  <Info className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80" align="start">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {THEORY_LABEL[rec.theory]}
                </p>
                <p className="mt-2 text-sm leading-relaxed">{rec.theoryDetail}</p>
                <div className="mt-3 rounded-md border border-border/60 bg-muted/40 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Trigger pattern
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rec.triggerPattern}
                  </p>
                </div>
              </HoverCardContent>
            </HoverCard>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
