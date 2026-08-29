import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/hooks/utils";
import { getMLWorkerAsync, setLoadProgressListener } from "@/lib/ml/mlWorkerStore";
import type { LoadProgress } from "@/lib/algorithm/models/distilXlmr";
import {
  preprocessFeedback,
  mapDiagnostics,
  computePriority,
  buildCue,
  rbtLabel,
  PRIORITY_THRESHOLD,
  type SimulationInput,
  type ExtractionResult,
  type DiagnosticMapping,
  type StrategyResult,
  type RecommendationItem,
} from "@/components/dev/simulationEngine";

const BLOOM_LEVELS = [
  { value: "1", label: "1 · Remember" },
  { value: "2", label: "2 · Understand" },
  { value: "3", label: "3 · Apply" },
  { value: "4", label: "4 · Analyze" },
  { value: "5", label: "5 · Evaluate" },
  { value: "6", label: "6 · Create" },
];

interface Preset {
  label: string;
  description: string;
  input: SimulationInput;
}

const PRESETS: Preset[] = [
  {
    label: "Cognitive Overload (Gap)",
    description: "Abstract logic gap, RBT 4 ≤ target 5, Intrinsic → gap, P ≥ 0.30",
    input: {
      topic: "Recursion & Divide-and-Conquer",
      iloStatement: "Design and analyze recursive algorithms for complex problems.",
      targetRbt: 5,
      feedbackText:
        "I can't break down the recursive cases into smaller subproblems. The abstract logic is really hard to follow and I keep getting lost.",
      totalFeedback: 10,
      issueOccurrences: 3,
    },
  },
  {
    label: "Pacing Issue",
    description: "Instructional cadence, RBT 2 ≤ target 3, Extraneous → not a gap, P ≥ 0.30",
    input: {
      topic: "Linked Lists",
      iloStatement: "Implement and manipulate singly linked list operations.",
      targetRbt: 3,
      feedbackText:
        "The lesson moves way too fast. We jump between topics without enough time to practice each one.",
      totalFeedback: 10,
      issueOccurrences: 4,
    },
  },
  {
    label: "Minor Feedback (Warning)",
    description: "Low prevalence → P < 0.30, passive diagnostic warning",
    input: {
      topic: "Stacks & Queues",
      iloStatement: "Apply stack and queue data structures to solve problems.",
      targetRbt: 3,
      feedbackText:
        "The notation for the stack operations is a bit confusing at first, but I think I get it now.",
      totalFeedback: 10,
      issueOccurrences: 1,
    },
  },
];

type ModelStatus = "loading" | "ready" | "error";

const STEP_META = [
  { label: "Context", icon: Target },
  { label: "Preprocess", icon: FileText },
  { label: "Extraction", icon: Cpu },
  { label: "Mapping", icon: Database },
  { label: "Strategy", icon: Scale },
  { label: "Output", icon: Activity },
];

export function AlgorithmSimulation() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<SimulationInput>({
    topic: "",
    iloStatement: "",
    targetRbt: 3,
    feedbackText: "",
    totalFeedback: 10,
    issueOccurrences: 3,
  });

  const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
  const [loadProgress, setLoadProgress] = useState<LoadProgress>({
    status: "loading",
    progress: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [mapping, setMapping] = useState<DiagnosticMapping | null>(null);
  const [strategy, setStrategy] = useState<StrategyResult | null>(null);
  const [cue, setCue] = useState<RecommendationItem | null>(null);

  const cleanedText = useMemo(() => {
    if (!input.feedbackText.trim()) return "";
    return preprocessFeedback(input.feedbackText);
  }, [input.feedbackText]);

  const modelReady = modelStatus === "ready";

  // Preload the real DistilXLM-R model on mount and subscribe to progress.
  useEffect(() => {
    let active = true;
    const unsubLoad = setLoadProgressListener((data) => {
      if (active) setLoadProgress(data);
    });

    (async () => {
      try {
        const { api } = await getMLWorkerAsync();
        await api.preloadModel();
        if (active) {
          setModelStatus("ready");
          setLoadProgress({ status: "done", progress: 100 });
        }
      } catch (err) {
        if (active) {
          setModelStatus("error");
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      active = false;
      unsubLoad();
    };
  }, []);

  const retryLoad = async () => {
    setModelStatus("loading");
    setLoadError(null);
    setLoadProgress({ status: "loading", progress: 0 });
    try {
      const { api } = await getMLWorkerAsync();
      await api.preloadModel();
      setModelStatus("ready");
      setLoadProgress({ status: "done", progress: 100 });
    } catch (err) {
      setModelStatus("error");
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  const runExtraction = async () => {
    setExtracting(true);
    try {
      const { api } = await getMLWorkerAsync();
      const result = await api.extractSingle({
        id: "simulation",
        rawText: input.feedbackText,
      });
      const diag = mapDiagnostics(result.issue, input.targetRbt);
      const strat = computePriority(input.issueOccurrences, input.totalFeedback, diag.isGap);
      const cueResult = buildCue(input, result.issue, diag, input.issueOccurrences);
      setExtraction(result);
      setMapping(diag);
      setStrategy(strat);
      setCue(cueResult);
    } catch (err) {
      setModelStatus("error");
      setLoadError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setExtracting(false);
    }
    return true;
  };

  const handleNext = async () => {
    if (step === 0) {
      if (!input.topic.trim() || !input.feedbackText.trim()) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!modelReady) return;
      const ok = await runExtraction();
      if (ok) setStep(3);
      return;
    }
    if (step < 6) {
      setStep(step + 1);
    }
  };

  const handleReset = () => {
    setStep(0);
    setExtraction(null);
    setMapping(null);
    setStrategy(null);
    setCue(null);
  };

  const applyPreset = (preset: Preset) => {
    setInput({ ...preset.input });
  };

  const canNext =
    step === 0
      ? input.topic.trim().length > 0 && input.feedbackText.trim().length > 0
      : step === 2
        ? modelReady && !extracting
        : step < 6;

  const nextLabel = step === 2 ? (extracting ? "Extracting…" : "Run extraction") : "Next Step";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Algorithm Simulation</h1>
          <p className="text-sm text-muted-foreground">
            Step through the 6-module pedagogical diagnostic pipeline using the real DistilXLM-R
            model.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            Step {step} / 6
          </Badge>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
          <Button onClick={handleNext} disabled={!canNext}>
            {extracting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {nextLabel}
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEP_META.map((meta, i) => {
          const Icon = meta.icon;
          const active = step === i + 1;
          const done = step > i + 1;
          return (
            <div key={meta.label} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                  active && "border-primary bg-primary/10 text-primary",
                  done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
                  !active && !done && "border-border text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                {meta.label}
              </div>
              {i < STEP_META.length - 1 && <div className="h-px w-4 bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Model readiness indicator */}
      <ModelStatusCard
        status={modelStatus}
        progress={loadProgress}
        error={loadError}
        onRetry={retryLoad}
      />

      {step === 0 && <InputSandbox input={input} setInput={setInput} onPreset={applyPreset} />}

      {step >= 1 && <StepContext input={input} />}

      {step >= 2 && <StepPreprocess input={input} cleanedText={cleanedText} />}

      {step >= 3 && extraction && <StepExtraction extraction={extraction} />}

      {step >= 4 && mapping && <StepMapping mapping={mapping} targetRbt={input.targetRbt} />}

      {step >= 5 && strategy && <StepStrategy strategy={strategy} />}

      {step >= 6 && cue && strategy && <StepOutput cue={cue} strategy={strategy} />}
    </div>
  );
}

function ModelStatusCard({
  status,
  progress,
  error,
  onRetry,
}: {
  status: ModelStatus;
  progress: LoadProgress;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Model failed to load</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span className="line-clamp-2">{error ?? "Unknown error loading DistilXLM-R."}</span>
          <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0">
            <RotateCcw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const ready = status === "ready";
  const pct = Math.round(progress.progress);
  const downloading = progress.source === "network" || progress.phase === "download";

  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            ready ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary",
          )}
        >
          {ready ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : downloading ? (
            <Download className="h-5 w-5" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {ready
                ? "DistilXLM-R model ready"
                : downloading
                  ? "Downloading DistilXLM-R model…"
                  : "Loading DistilXLM-R model…"}
            </p>
            {!ready && <span className="font-mono text-xs text-muted-foreground">{pct}%</span>}
          </div>
          {!ready && <Progress value={pct} className="mt-2" aria-label="Model load progress" />}
          <p className="mt-1 text-xs text-muted-foreground">
            {ready
              ? "The model is cached in your browser — repeat visits skip the download."
              : "The model must finish loading before the Information Extraction step can run."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function InputSandbox({
  input,
  setInput,
  onPreset,
}: {
  input: SimulationInput;
  setInput: (updater: (prev: SimulationInput) => SimulationInput) => void;
  onPreset: (preset: Preset) => void;
}) {
  const set = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 0 · Configure Simulation</CardTitle>
        <CardDescription>
          Define the session context, student feedback, and simulated cohort to run through the
          pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPreset(preset)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {preset.label}
            </Button>
          ))}
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sim-topic">Topic title</Label>
            <Input
              id="sim-topic"
              value={input.topic}
              onChange={(e) => set("topic", e.target.value)}
              placeholder="e.g. Recursion & Divide-and-Conquer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sim-ilo">Target ILO statement</Label>
            <Input
              id="sim-ilo"
              value={input.iloStatement}
              onChange={(e) => set("iloStatement", e.target.value)}
              placeholder="e.g. Design and analyze recursive algorithms…"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sim-feedback">Student feedback (raw)</Label>
          <Textarea
            id="sim-feedback"
            value={input.feedbackText}
            onChange={(e) => set("feedbackText", e.target.value)}
            placeholder="Paste a sample student feedback entry…"
            rows={4}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sim-rbt">Target Bloom level (RBT_target)</Label>
            <select
              id="sim-rbt"
              value={String(input.targetRbt)}
              onChange={(e) => set("targetRbt", Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {BLOOM_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sim-total">Simulated Total Feedback (Total_F)</Label>
            <Input
              id="sim-total"
              type="number"
              min={1}
              value={input.totalFeedback}
              onChange={(e) => set("totalFeedback", Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sim-occ">Simulated Issue Occurrences</Label>
            <Input
              id="sim-occ"
              type="number"
              min={0}
              value={input.issueOccurrences}
              onChange={(e) => set("issueOccurrences", Math.max(0, Number(e.target.value)))}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          The simulated cohort lets you demonstrate both branches: set occurrences so that{" "}
          <span className="font-mono">P = (count / Total_F) × w_c</span> crosses the{" "}
          <span className="font-mono">0.30</span> threshold (recommendation) or stays below it
          (warning).
        </p>
      </CardContent>
    </Card>
  );
}

function StepContext({ input }: { input: SimulationInput }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1 · Session Context (Module 1)</CardTitle>
        <CardDescription>
          Data collection — session context and empty diagnostic buffers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Topic" value={input.topic || "—"} />
        <Row label="Target ILO" value={input.iloStatement || "—"} />
        <Row label="Target Bloom level (RBT_target)" value={rbtLabel(input.targetRbt)} />
        <Row label="Diagnostic buffer" value="[] (empty — awaiting feedback loop)" mono />
      </CardContent>
    </Card>
  );
}

function StepPreprocess({ input, cleanedText }: { input: SimulationInput; cleanedText: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2 · Preprocessing (Module 2)</CardTitle>
        <CardDescription>
          Noise removal, vowel reduction, abbreviation expansion, and whitespace normalization.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Raw feedback</Label>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {input.feedbackText || "—"}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Cleaned text</Label>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            {cleanedText || "—"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StepExtraction({ extraction }: { extraction: ExtractionResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3 · Information Extraction (Module 3)</CardTitle>
        <CardDescription>
          Real DistilXLM-R (PID-ABSA) inference on the cleaned text.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Extracted Issue" value={extraction.issue} />
          <Stat label="Polarity" value={extraction.polarity} />
          <Stat
            label="Model Confidence"
            value={`${(extraction.confidence * 100).toFixed(1)}%`}
            highlight={extraction.confidence >= 0.5}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Inference latency: {extraction.latencyMs.toFixed(1)} ms
        </p>
      </CardContent>
    </Card>
  );
}

function StepMapping({ mapping, targetRbt }: { mapping: DiagnosticMapping; targetRbt: number }) {
  const gapTrue = mapping.rbt <= targetRbt && mapping.clt === "Intrinsic";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4 · Pedagogical Diagnostic Mapping (Module 4)</CardTitle>
        <CardDescription>
          Rule-table lookup for TTI, RBT, and CLT from the extracted issue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="TTI (Aspect)" value={mapping.tti} />
          <Stat label="RBT_issue" value={`${mapping.rbt} · ${rbtLabel(mapping.rbt)}`} />
          <Stat label="CLT" value={mapping.clt} />
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <p className="mb-2 text-sm font-medium">is_gap evaluation</p>
          <p className="font-mono text-xs text-muted-foreground">
            is_gap = (rbt ≤ target_ilo_rbt) AND (clt == "Intrinsic")
          </p>
          <p className="mt-2 font-mono text-sm">
            ({mapping.rbt} ≤ {targetRbt}) AND ({mapping.clt} == "Intrinsic") ={" "}
            <span className={gapTrue ? "text-emerald-600" : "text-destructive"}>
              {String(gapTrue)}
            </span>
          </p>
          <Badge
            className={cn(
              "mt-2",
              gapTrue ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
            )}
          >
            {gapTrue ? "Gap detected" : "Not a gap"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function StepStrategy({ strategy }: { strategy: StrategyResult }) {
  const pct = (strategy.priorityScore * 100).toFixed(1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5 · Strategy Generation (Module 5)</CardTitle>
        <CardDescription>Unified priority scoring and threshold trigger.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="w_c (weight)" value={String(strategy.weightedCoefficient)} />
          <Stat label="Issue count" value={String(strategy.issueCount)} />
          <Stat label="Total_F" value={String(strategy.totalFeedback)} />
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <p className="mb-2 text-sm font-medium">Priority score (P)</p>
          <p className="font-mono text-xs text-muted-foreground">
            P = (issue_count / Total_F) × w_c
          </p>
          <p className="mt-2 font-mono text-sm">
            P = ({strategy.issueCount} / {strategy.totalFeedback}) × {strategy.weightedCoefficient}{" "}
            = <span className="font-semibold text-primary">{pct}%</span>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/20">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, strategy.priorityScore * 100)}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground">threshold 30%</span>
          </div>
          <Badge
            className={cn(
              "mt-3",
              strategy.triggersRecommendation
                ? "bg-primary/10 text-primary"
                : "bg-amber-500/10 text-amber-600",
            )}
          >
            {strategy.triggersRecommendation
              ? `P ≥ ${PRIORITY_THRESHOLD} → Recommendation`
              : `P < ${PRIORITY_THRESHOLD} → Diagnostic Warning`}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function StepOutput({ cue, strategy }: { cue: RecommendationItem; strategy: StrategyResult }) {
  const isRecommendation = strategy.triggersRecommendation;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 6 · Dashboard Output (Module 6)</CardTitle>
        <CardDescription>
          {isRecommendation
            ? "Threshold met — full pedagogical recommendation cue generated."
            : "Threshold not met — passive diagnostic warning generated."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "rounded-lg border p-4",
            isRecommendation
              ? "border-primary/40 bg-primary/5"
              : "border-amber-500/40 bg-amber-500/5",
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            {isRecommendation ? (
              <Sparkles className="h-4 w-4 text-primary" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <span className="text-sm font-semibold">
              {isRecommendation ? "Pedagogical Recommendation" : "Diagnostic Warning"}
            </span>
            <Badge variant="outline" className="ml-auto font-mono">
              {cue.issue}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{cue.paragraph}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cue.terms.map((term, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="h-auto py-1 font-normal whitespace-normal"
            >
              <span className="font-medium">{term.text}</span>
              <span className="ml-1 shrink-0 whitespace-nowrap text-muted-foreground">
                · {term.kind}
              </span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold", highlight && "text-emerald-600")}>{value}</p>
    </div>
  );
}
