import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  Download,
  FileText,
  Info,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { PRESETS, type Preset } from "./simulationPresets";

const BLOOM_LEVELS = [
  { value: "1", label: "1 · Remember" },
  { value: "2", label: "2 · Understand" },
  { value: "3", label: "3 · Apply" },
  { value: "4", label: "4 · Analyze" },
  { value: "5", label: "5 · Evaluate" },
  { value: "6", label: "6 · Create" },
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

const EMPTY_INPUT: SimulationInput = {
  topic: "",
  iloStatement: "",
  targetRbt: 0,
  feedbackText: "",
  totalFeedback: 0,
  issueOccurrences: 0,
};

export function AlgorithmSimulation() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<SimulationInput>({ ...EMPTY_INPUT });

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
      const strat = computePriority(
        result.issue,
        input.issueOccurrences,
        input.totalFeedback,
        diag.isGap,
      );
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
    setInput({ ...EMPTY_INPUT });
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
      ? input.topic.trim().length > 0 &&
        input.feedbackText.trim().length > 0 &&
        input.targetRbt >= 1 &&
        input.totalFeedback >= 1
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

      {step >= 4 && mapping && extraction && (
        <StepMapping mapping={mapping} targetRbt={input.targetRbt} issue={extraction.issue} />
      )}

      {step >= 5 && strategy && <StepStrategy strategy={strategy} />}

      {step >= 6 && strategy && <StepOutput cue={cue} strategy={strategy} />}
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

function StepNumber({
  id,
  label,
  min,
  value,
  onChange,
  incrementLabel,
  decrementLabel,
}: {
  id: string;
  label: string;
  min: number;
  value: number;
  onChange: (value: number) => void;
  incrementLabel: string;
  decrementLabel: string;
}) {
  const clamp = (n: number) => Math.max(min, Number.isFinite(n) ? n : 0);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex h-9 rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <Input
          id={id}
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="h-full border-0 bg-transparent shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="flex flex-col divide-y divide-input border-l border-input">
          <button
            type="button"
            aria-label={incrementLabel}
            onClick={() => onChange(value + 1)}
            className="flex h-1/2 items-center justify-center px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={decrementLabel}
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="flex h-1/2 items-center justify-center px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
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
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [issueOccurrencesTouched, setIssueOccurrencesTouched] = useState(false);

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
              variant={activePreset?.label === preset.label ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                onPreset(preset);
                setActivePreset(preset);
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {preset.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {activePreset
            ? `${activePreset.label} — ${activePreset.description}`
            : "Select a preset to load a pre-configured scenario, or configure the fields below manually."}
        </p>

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
            <Label htmlFor="sim-rbt">Target Bloom level (target_ILO_rbt)</Label>
            <Select
              value={input.targetRbt === 0 ? "" : String(input.targetRbt)}
              onValueChange={(v) => set("targetRbt", Number(v))}
            >
              <SelectTrigger
                id="sim-rbt"
                className={input.targetRbt >= 1 ? "[&>svg]:text-primary [&>svg]:opacity-70" : ""}
              >
                <SelectValue placeholder="Select RBT level" />
              </SelectTrigger>
              <SelectContent>
                {BLOOM_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <StepNumber
            id="sim-total"
            label="Simulated Total Feedback (Total_F)"
            min={1}
            value={input.totalFeedback}
            onChange={(v) => set("totalFeedback", v)}
            incrementLabel="Increase total feedback"
            decrementLabel="Decrease total feedback"
          />
          <StepNumber
            id="sim-occ"
            label="Simulated Issue Occurrences"
            min={issueOccurrencesTouched ? 1 : 0}
            value={input.issueOccurrences}
            onChange={(v) => {
              if (v >= 1) setIssueOccurrencesTouched(true);
              set("issueOccurrences", v);
            }}
            incrementLabel="Increase issue occurrences"
            decrementLabel="Decrease issue occurrences"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          The simulated cohort lets you demonstrate both branches: set occurrences so that{" "}
          <span className="font-mono">P = (count / Total_F) x w_c</span> crosses the{" "}
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
        <CardTitle>Step 1 · Data Collection (Module 1)</CardTitle>
        <CardDescription>
          Data collection — session context fed into the Module 2–4 feedback loop.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Topic" value={input.topic || "—"} />
        <Row label="Target ILO" value={input.iloStatement || "—"} />
        <Row
          label="Target Bloom level (target_ILO_rbt)"
          value={input.targetRbt >= 1 ? `${input.targetRbt} · ${rbtLabel(input.targetRbt)}` : "—"}
        />
        <Row label="Feedback (raw)" value={input.feedbackText || "—"} />
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
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Extracted Issue" value={extraction.issue} />
          <Stat label="Polarity" value={extraction.polarity} />
          <Stat
            label="Model Confidence"
            value={`${(extraction.confidence * 100).toFixed(1)}%`}
            highlight={extraction.confidence >= 0.5}
          />
          <Stat label="Inference Latency" value={`${extraction.latencyMs.toFixed(1)} ms`} />
        </div>
      </CardContent>
    </Card>
  );
}

function StepMapping({
  mapping,
  targetRbt,
  issue,
}: {
  mapping: DiagnosticMapping;
  targetRbt: number;
  issue: string;
}) {
  const uncategorized = mapping.clt === "Uncategorized";
  const rbtDisplay = uncategorized ? "N/A" : mapping.rbt;
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
          <Stat
            label="RBT_issue"
            value={
              uncategorized
                ? rbtLabel(mapping.rbt, issue)
                : `${mapping.rbt} · ${rbtLabel(mapping.rbt)}`
            }
          />
          <Stat label="CLT" value={mapping.clt} />
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <p className="mb-2 text-sm font-medium">is_gap evaluation</p>
          <p className="font-mono text-xs text-muted-foreground">
            is_gap = (rbt ≤ target_ILO_rbt) AND (clt == "Intrinsic")
          </p>
          <p className="mt-2 font-mono text-sm">
            is_gap = ({rbtDisplay} ≤ {targetRbt}) AND ({mapping.clt} == "Intrinsic")
          </p>
          <p className="mt-2 font-mono text-sm">
            is_gap = ({String(mapping.rbt <= targetRbt)}) AND ({String(mapping.clt === "Intrinsic")}
            )
          </p>
          <p className="mt-2 font-mono text-sm">
            is_gap ={" "}
            <span className={mapping.isGap ? "text-emerald-600" : "text-destructive"}>
              {String(mapping.isGap)}
            </span>
          </p>
          <Badge
            className={cn(
              "mt-3",
              mapping.isGap ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {mapping.isGap ? "Gap detected" : "Not a gap"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function StepStrategy({ strategy }: { strategy: StrategyResult }) {
  if (strategy.isExcluded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Step 5 · Strategy Generation (Module 5)</CardTitle>
          <CardDescription>Unified priority scoring and threshold trigger.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="issue_count" value={String(strategy.issueCount)} />
            <Stat label="Total_F (total feedback)" value={String(strategy.totalFeedback)} />
            <Stat label="w_c (criticality weight)" value="—" />
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="mb-2 text-sm font-medium">Priority score (P)</p>
            <p className="font-mono text-xs text-muted-foreground">
              P = (issue_count / Total_F) x w_c — bypassed for uncategorized feedback
            </p>
            <Alert className="mt-3 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
              <Info className="h-4 w-4" />
              <AlertTitle>Excluded from Unified Priority Scoring</AlertTitle>
              <AlertDescription>
                Uncategorized feedback does not carry pedagogical weight.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pct = (strategy.priorityScore * 100).toFixed(1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5 · Strategy Generation (Module 5)</CardTitle>
        <CardDescription>Unified priority scoring and threshold trigger.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="issue_count" value={String(strategy.issueCount)} />
          <Stat label="Total_F (total feedback)" value={String(strategy.totalFeedback)} />
          <Stat label="w_c (criticality weight)" value={String(strategy.weightedCoefficient)} />
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <p className="mb-2 text-sm font-medium">Priority score (P)</p>
          <p className="font-mono text-xs text-muted-foreground">
            P = (issue_count / Total_F) x w_c
          </p>
          <p className="mt-2 font-mono text-sm">
            P = ({strategy.issueCount} / {strategy.totalFeedback}) x{" "}
            {strategy.weightedCoefficient}{" "}
          </p>
          <p className="mt-2 font-mono text-sm">
            P ={" "}
            <span className="font-medium">
              {(strategy.issueCount / strategy.totalFeedback).toFixed(1)}
            </span>{" "}
            x {strategy.weightedCoefficient}{" "}
          </p>
          <p className="mt-2 font-mono text-sm">
            P = <span className="font-semibold text-primary">{pct}%</span>
          </p>
          <Badge
            className={cn(
              "mt-3",
              strategy.triggersRecommendation
                ? "bg-primary/10 text-primary"
                : "bg-warning/10 text-warning",
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

const WARNING_TERM_KINDS = new Set(["prevalence", "TTI", "RBT", "CLT"]);

function StepOutput({
  cue,
  strategy,
}: {
  cue: RecommendationItem | null;
  strategy: StrategyResult;
}) {
  if (strategy.isExcluded || !cue) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Step 6 · Dashboard Output (Module 6)</CardTitle>
          <CardDescription>
            Uncategorized feedback — no recommendation or warning generated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-400/40 bg-slate-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold">Uncategorized Diagnostic Notice</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This feedback was classified as{" "}
              <span className="font-medium text-foreground">Uncategorized</span> — it does not match
              any known pedagogical issue pattern. Diagnostic mapping, priority scoring, and
              strategy generation are bypassed, so no recommendation or warning is generated for
              this entry.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isRecommendation = strategy.triggersRecommendation;
  const pct = (strategy.priorityScore * 100).toFixed(1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 6 · Dashboard Output (Module 6)</CardTitle>
        <CardDescription>
          {isRecommendation
            ? "Threshold met — full pedagogical recommendation cue generated."
            : "Threshold not met — passive diagnostic warning monitor."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRecommendation ? (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Recommendation Cue</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{cue.paragraph}</p>
            <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        ) : (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold">Diagnostic Warning Monitor</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Low-prevalence diagnostic alert — {pct}% of the class. Below the 30% recommendation
              threshold; no instructional intervention is triggered. Monitor in the next session.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {cue.terms
                .filter((term) => WARNING_TERM_KINDS.has(term.kind))
                .map((term, i) => (
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[240px_1fr] sm:items-start sm:gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words font-medium sm:text-right", mono && "font-mono")}>
        {value}
      </span>
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
