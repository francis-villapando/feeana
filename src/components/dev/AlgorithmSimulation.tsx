import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  Download,
  FileText,
  Hash,
  Info,
  ListOrdered,
  Loader2,
  RotateCcw,
  Scale,
  Sparkles,
  Target,
  Wifi,
  WifiOff,
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
import { inspectPreprocessingSteps } from "@/lib/algorithm/preprocess";
import {
  TTI_RULES,
  RBT_RULES,
  CLT_RULES,
  ISSUE_RULES,
  ISSUE_RECOMMENDATIONS,
  RBT_LEVELS,
} from "@/lib/algorithm/rules";
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

const ALL_TAXONOMY_ISSUES = [
  // Intrinsic Load (Direct Concept & Subject Bottlenecks — Candidate Learning Gaps, RBT 1 → 6)
  "notation struggle", // RBT 1 · Remember (Language Modeling)
  "conceptual misalignment", // RBT 2 · Understand (Concept Development)
  "procedural bottleneck", // RBT 3 · Apply (Concept Development)
  "abstract logic gap", // RBT 4 · Analyze (Concept Development)
  "design synthesis failure", // RBT 6 · Create (Concept Development)

  // Extraneous Load (Classroom Climate, Interaction & Delivery Friction, RBT 1 → 2)
  "relational coldness", // RBT 1 · Remember (Positive Climate)
  "classroom tension", // RBT 1 · Remember (Negative Climate)
  "evaluation unfairness", // RBT 1 · Remember (Teacher Sensitivity)
  "perceived marginalization", // RBT 1 · Remember (Regard for Student Perspectives)
  "subject alienation", // RBT 1 · Remember (Regard for Student Perspectives)
  "peer distraction", // RBT 1 · Remember (Behavior Management)
  "instructional cadence", // RBT 2 · Understand (Productivity)
  "clarity deficit", // RBT 2 · Understand (Instructional Learning Formats)
  "feedback latency", // RBT 2 · Understand (Quality of Feedback)
];

type ModelStatus = "loading" | "ready" | "error";

const PHASE_META = [
  { label: "Phase 1: Context", icon: Target },
  { label: "Phase 2: Preprocess", icon: FileText },
  { label: "Phase 3: Extraction", icon: Cpu },
  { label: "Phase 4: Mapping", icon: Database },
  { label: "Phase 5: Strategy", icon: Scale },
  { label: "Phase 6: Output", icon: Activity },
];

const EMPTY_INPUT: SimulationInput = {
  topic: "",
  iloStatement: "",
  targetRbt: 0,
  feedbackText: "",
  totalFeedback: 0,
  issueOccurrences: 0,
};

// Live browser connectivity state. Inference runs 100% locally in WASM, so the
// model keeps working even when the network is offline.
function useNetworkStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function AlgorithmSimulation() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<SimulationInput>({ ...EMPTY_INPUT });
  const online = useNetworkStatus();

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
  const [tokenization, setTokenization] = useState<ExtractionResult["tokenization"] | null>(null);
  const [tokenizing, setTokenizing] = useState<boolean>(false);

  const cleanedText = useMemo(() => {
    if (!input.feedbackText.trim()) return "";
    return preprocessFeedback(input.feedbackText);
  }, [input.feedbackText]);

  const modelReady = modelStatus === "ready";

  // When on Phase 2 or when input changes while model is ready, compute tokenization immediately
  useEffect(() => {
    if (!input.feedbackText.trim() || !modelReady) {
      setTokenization(null);
      return;
    }
    let active = true;
    setTokenizing(true);
    (async () => {
      try {
        const { api } = await getMLWorkerAsync();
        const tok = await api.tokenizeSingle(input.feedbackText);
        if (active) {
          setTokenization(tok);
        }
      } catch (err) {
        console.warn("Tokenization in Phase 2 failed:", err);
      } finally {
        if (active) setTokenizing(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [input.feedbackText, modelReady]);

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
    setTokenization(null);
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

  const nextLabel = step === 2 ? (extracting ? "Extracting…" : "Run extraction") : "Next Phase";

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
          <Badge
            variant="outline"
            className={cn(
              "font-mono",
              online ? "border-emerald-500/40 text-emerald-600" : "border-warning/40 text-warning",
            )}
          >
            {online ? (
              <Wifi className="mr-1 h-3.5 w-3.5" />
            ) : (
              <WifiOff className="mr-1 h-3.5 w-3.5" />
            )}
            {online ? "Online" : "Offline (WASM Local Mode)"}
          </Badge>
          <Badge variant="outline" className="font-mono">
            Phase {step} / 6
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
        {PHASE_META.map((meta, i) => {
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
              {i < PHASE_META.length - 1 && <div className="h-px w-4 bg-border" />}
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

      {step >= 2 && (
        <StepPreprocess
          input={input}
          cleanedText={cleanedText}
          tokenization={tokenization ?? extraction?.tokenization ?? null}
          tokenizing={tokenizing}
          modelReady={modelReady}
        />
      )}

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
        <CardTitle>Phase 0 · Configure Simulation</CardTitle>
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
        <CardTitle>Phase 1 · Data Collection (Module 1)</CardTitle>
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
        <Row label="Feedback (raw)" value={input.feedbackText || "—"} preWrap />
      </CardContent>
    </Card>
  );
}

function StepPreprocess({
  input,
  cleanedText,
  tokenization,
  tokenizing,
  modelReady,
}: {
  input: SimulationInput;
  cleanedText: string;
  tokenization?: ExtractionResult["tokenization"] | null;
  tokenizing?: boolean;
  modelReady?: boolean;
}) {
  const steps = useMemo(() => {
    if (!input.feedbackText.trim()) return null;
    return inspectPreprocessingSteps(input.feedbackText);
  }, [input.feedbackText]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phase 2 · Preprocessing (Module 2)</CardTitle>
        <CardDescription>
          Noise removal, vowel reduction, abbreviation expansion, whitespace normalization, and
          tensor encoding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Raw vs Cleaned diff */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col space-y-2">
            <Label>Raw feedback</Label>
            <div className="flex-1 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {input.feedbackText || "—"}
            </div>
          </div>
          <div className="flex flex-col space-y-2">
            <Label>Cleaned text</Label>
            <div className="flex-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              {cleanedText || "—"}
            </div>
          </div>
        </div>

        {/* Multi-stage transformation timeline */}
        {steps && (
          <div className="space-y-2">
            <Label>Transformation timeline</Label>
            <div className="space-y-2">
              <StageRow
                label="1 · Noise Removal"
                detail="Strip URLs, @mentions, #hashtags, emojis"
                value={steps.afterNoise}
                highlight={steps.afterNoise !== steps.rawText}
                changed={steps.afterNoise !== steps.rawText}
              />
              <StageRow
                label="2 · Vowel Normalization"
                detail="Collapse repeated characters"
                value={steps.afterVowels}
                highlight={steps.afterVowels !== steps.afterNoise}
                changed={steps.afterVowels !== steps.afterNoise}
              />
              <StageRow
                label="3 · Abbreviation Expansion"
                detail="Expand slang"
                value={steps.afterAbbrevs}
                highlight={steps.afterAbbrevs !== steps.afterVowels}
                changed={steps.afterAbbrevs !== steps.afterVowels}
              />
              <StageRow
                label="4 · Whitespace Normalization"
                detail="Trim and collapse whitespace"
                value={steps.cleanedText}
                highlight={steps.cleanedText !== steps.afterAbbrevs}
                changed={steps.cleanedText !== steps.afterAbbrevs}
              />
            </div>
          </div>
        )}

        {/* Unified Tensor & Token Representation Table */}
        {tokenization ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Unified Tensor & Token Representation</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  <Braces className="mr-1 h-3 w-3" /> shape {tokenization.tensorShape[0]}×
                  {tokenization.tensorShape[1]}
                </Badge>
                <Badge variant="outline" className="font-mono">
                  dtype {tokenization.dataType}
                </Badge>
                <Badge variant="outline" className="font-mono">
                  {tokenization.totalTokens} active tokens
                </Badge>
                <Badge variant="outline" className="font-mono">
                  {tokenization.maxLength - tokenization.totalTokens} padding slots
                </Badge>
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="overflow-x-auto pb-2 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-2">
                <table className="min-w-full border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="sticky left-0 z-10 w-28 min-w-[7rem] bg-muted/95 p-2 text-left font-medium backdrop-blur-sm">
                        Index
                      </th>
                      {Array.from({ length: tokenization.maxLength }, (_, i) => (
                        <th
                          key={i}
                          className={cn(
                            "min-w-[4rem] px-2 py-1 text-center font-normal",
                            i < tokenization.totalTokens
                              ? "font-medium text-foreground"
                              : "text-muted-foreground/40",
                          )}
                        >
                          #{i}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    <tr>
                      <td className="sticky left-0 z-10 w-28 min-w-[7rem] bg-muted/95 p-2 font-medium text-foreground backdrop-blur-sm">
                        input_ids
                      </td>
                      {Array.from({ length: tokenization.maxLength }, (_, i) => {
                        const id = tokenization.inputIdsPreview[i] ?? 0;
                        const isActive = i < tokenization.totalTokens;
                        return (
                          <td
                            key={i}
                            className={cn(
                              "min-w-[4rem] px-2 py-1.5 text-center",
                              isActive
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground/30",
                            )}
                          >
                            {id}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 w-28 min-w-[7rem] bg-muted/95 p-2 font-medium text-foreground backdrop-blur-sm">
                        attention_mask
                      </td>
                      {Array.from({ length: tokenization.maxLength }, (_, i) => {
                        const mask = tokenization.attentionMaskPreview[i] ?? 0;
                        const isActive = mask === 1;
                        return (
                          <td
                            key={i}
                            className={cn(
                              "min-w-[4rem] px-2 py-1.5 text-center",
                              isActive
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground/30",
                            )}
                          >
                            {mask}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="sticky left-0 z-10 w-28 min-w-[7rem] bg-muted/95 p-2 font-medium text-foreground backdrop-blur-sm">
                        Subword tokens
                      </td>
                      {Array.from({ length: tokenization.maxLength }, (_, i) => {
                        const subword = tokenization.subwords[i];
                        const hasToken = i < tokenization.totalTokens && subword !== undefined;
                        const isSpecial = subword === "<s>" || subword === "</s>";
                        return (
                          <td
                            key={i}
                            className={cn(
                              "min-w-[4rem] px-2 py-1.5 text-center",
                              hasToken
                                ? isSpecial
                                  ? "font-semibold text-foreground"
                                  : "text-foreground/90"
                                : "text-muted-foreground/30",
                            )}
                          >
                            {hasToken ? subword : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {tokenizing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Computing subwords & 1×256 tensor encodings…</span>
                </>
              ) : !modelReady ? (
                <span>
                  DistilXLM-R model is loading. Tensor encoding table will appear automatically once
                  ready.
                </span>
              ) : (
                <span>Enter student feedback above to generate tensor encodings.</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StageRow({
  label,
  detail,
  value,
  highlight,
  changed,
}: {
  label: string;
  detail: string;
  value: string;
  highlight: boolean;
  changed?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <span className="flex items-center gap-2">
          {changed && (
            <Badge variant="outline" className="font-mono text-[10px]">
              changed
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground">{detail}</span>
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
        {value || "—"}
      </p>
    </div>
  );
}

function StepExtraction({ extraction }: { extraction: ExtractionResult }) {
  const meta = extraction.executionMeta;
  const polarityConf =
    extraction.polarityDistribution.find(
      (p) => p.label.toLowerCase() === extraction.polarity.toLowerCase(),
    )?.probability ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phase 3 · Information Extraction (Module 3)</CardTitle>
        <CardDescription>
          Real DistilXLM-R (PID-ABSA) inference on the cleaned text.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Execution telemetry */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {meta.modelName}
          </Badge>
          <Badge variant="secondary" className="font-mono">
            {meta.runtime}
          </Badge>
          <Badge variant="outline" className="font-mono">
            seq_len {meta.sequenceLength}
          </Badge>
          <Badge variant="outline" className="font-mono">
            {meta.latencyMs.toFixed(1)} ms
          </Badge>
        </div>

        {/* Top-5 issue probability distribution */}
        <div className="space-y-2">
          <Label>Top-5 predicted issues (softmax probability)</Label>
          <div className="rounded-md border border-border bg-muted/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-block h-3 w-px bg-foreground/60" />
              <span>
                Fallback threshold {(extraction.confidenceThreshold * 100).toFixed(1)}% — a top-1
                probability below this routes to Uncategorized
              </span>
            </div>
            <div className="space-y-2">
              {extraction.topKIssues.map((entry, i) => (
                <ProbabilityBar
                  key={entry.label}
                  rank={i + 1}
                  label={entry.label}
                  probability={entry.probability}
                  logit={entry.logit}
                  deltaFromTop={entry.deltaFromTop}
                  isTop={i === 0}
                  threshold={extraction.confidenceThreshold}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Confidence threshold decision */}
        <div className="space-y-2">
          {extraction.routedDueToLowConfidence ? (
            <Alert variant="destructive" className="[&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Low Confidence Fallback</AlertTitle>
              <AlertDescription>
                Top confidence{" "}
                <span className="font-mono font-semibold">
                  {(extraction.rawConfidence * 100).toFixed(1)}%
                </span>{" "}
                &lt;{" "}
                <span className="font-mono font-semibold">
                  {(extraction.confidenceThreshold * 100).toFixed(1)}%
                </span>{" "}
                Threshold → Routed to <span className="font-semibold">Uncategorized</span> (Raw
                model candidate: <span className="font-mono">{extraction.rawIssue}</span> at{" "}
                <span className="font-mono">{(extraction.rawConfidence * 100).toFixed(1)}%</span>)
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-500/40 bg-emerald-500/5 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle>Confidence Threshold Passed</AlertTitle>
              <AlertDescription>
                Confidence{" "}
                <span className="font-mono font-semibold">
                  {(extraction.confidence * 100).toFixed(1)}%
                </span>{" "}
                ≥{" "}
                <span className="font-mono font-semibold">
                  {(extraction.confidenceThreshold * 100).toFixed(1)}%
                </span>{" "}
                Threshold → Retained predicted category:{" "}
                <span className="font-semibold">{extraction.issue}</span>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Polarity distribution */}
        <div className="space-y-2">
          <Label>Polarity distribution</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {extraction.polarityDistribution.map((entry) => (
              <div key={entry.label} className="rounded-md border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium capitalize">{entry.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {(entry.probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/70 transition-all"
                    style={{ width: `${entry.probability * 100}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  logit {entry.logit.toFixed(3)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Extracted classification results */}
        <div className="space-y-2">
          <Label>Extracted classification results</Label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Extracted Issue"
              value={extraction.issue}
              subvalue={`${(extraction.confidence * 100).toFixed(1)}%`}
            />
            <Stat
              label="Polarity"
              value={extraction.polarity}
              subvalue={`${(polarityConf * 100).toFixed(1)}%`}
            />
            <Stat label="Inference Latency" value={`${extraction.latencyMs.toFixed(1)} ms`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProbabilityBar({
  rank,
  label,
  probability,
  logit,
  deltaFromTop,
  isTop,
  threshold,
}: {
  rank: number;
  label: string;
  probability: number;
  logit: number;
  deltaFromTop?: number;
  isTop: boolean;
  threshold: number;
}) {
  const failsThreshold = isTop && probability < threshold;
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {rank}
      </span>
      <span className="w-40 shrink-0 truncate text-xs font-medium">{label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
        <div
          className={cn(
            "h-full rounded transition-all",
            failsThreshold ? "bg-destructive" : isTop ? "bg-primary" : "bg-primary/50",
          )}
          style={{ width: `${Math.max(probability * 100, 1)}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-foreground/60"
          style={{ left: `${threshold * 100}%` }}
          title={`Fallback threshold ${(threshold * 100).toFixed(1)}%`}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-xs">
        {(probability * 100).toFixed(1)}%
      </span>
      <span className="w-36 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
        logit {logit.toFixed(3)}
        {deltaFromTop !== undefined && deltaFromTop > 0 && (
          <span className="ml-1 text-warning">−{(deltaFromTop * 100).toFixed(1)}%</span>
        )}
      </span>
    </div>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phase 4 · Pedagogical Diagnostic Mapping (Module 4)</CardTitle>
        <CardDescription>
          Rule-table lookup for TTI, RBT, and CLT from the extracted issue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Pedagogical Rule Taxonomy Table */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Pedagogical Rule Taxonomy (Module 4 Table)</Label>
            <span className="text-[11px] text-muted-foreground">
              Active match highlighted from predicted issue
            </span>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="max-h-60 overflow-y-auto overflow-x-auto pb-2 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2">
              <table className="min-w-full border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="sticky top-0 z-10 bg-muted/95 p-2 text-left font-medium backdrop-blur-sm">
                      Issue
                    </th>
                    <th className="sticky top-0 z-10 bg-muted/95 p-2 text-left font-medium backdrop-blur-sm">
                      Aspect (TTI)
                    </th>
                    <th className="sticky top-0 z-10 bg-muted/95 p-2 text-center font-medium backdrop-blur-sm">
                      Level (RBT)
                    </th>
                    <th className="sticky top-0 z-10 bg-muted/95 p-2 text-center font-medium backdrop-blur-sm">
                      Cognitive Load (CLT)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ALL_TAXONOMY_ISSUES.map((key) => {
                    const name = ISSUE_RULES[key] ?? key;
                    const tti = TTI_RULES[key] ?? "—";
                    const rbt = RBT_RULES[key] ?? 1;
                    const clt = CLT_RULES[key] ?? "Extraneous";
                    const isMatched =
                      !uncategorized &&
                      (issue.toLowerCase() === key.toLowerCase() ||
                        issue.toLowerCase() === name.toLowerCase());

                    return (
                      <tr
                        key={key}
                        className={cn(
                          "transition-colors",
                          isMatched
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-muted-foreground/80 hover:bg-muted/40",
                        )}
                      >
                        <td className="p-2">{name}</td>
                        <td className="p-2 font-sans text-xs">{tti}</td>
                        <td className="p-2 text-center">
                          {rbt} · {rbtLabel(rbt)}
                        </td>
                        <td className="p-2 text-center">
                          <Badge
                            variant={clt === "Intrinsic" ? "default" : "secondary"}
                            className={cn(
                              "font-mono text-[10px]",
                              isMatched &&
                                clt === "Intrinsic" &&
                                "bg-primary text-primary-foreground",
                            )}
                          >
                            {clt}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {uncategorized && (
                    <tr className="bg-destructive/10 font-semibold text-destructive">
                      <td className="p-2">Uncategorized</td>
                      <td className="p-2 font-sans text-xs">Uncategorized</td>
                      <td className="p-2 text-center">0 · None</td>
                      <td className="p-2 text-center">
                        <Badge variant="destructive" className="font-mono text-[10px]">
                          Uncategorized
                        </Badge>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="TTI" value={mapping.tti} />
          <Stat
            label="RBT"
            value={
              uncategorized
                ? rbtLabel(mapping.rbt, issue)
                : `${mapping.rbt} · ${rbtLabel(mapping.rbt)}`
            }
          />
          <Stat label="CLT" value={mapping.clt} />
        </div>

        {/* is_gap evaluation */}
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <p className="mb-2 text-sm font-medium">is_gap evaluation</p>
          <p className="font-mono text-xs text-muted-foreground">
            is_gap = (rbt ≤ target_ILO_rbt) AND (clt == &quot;Intrinsic&quot;)
          </p>
          <div className="mt-3 space-y-1.5 font-mono text-sm">
            {uncategorized ? (
              <>
                <p className="text-muted-foreground">
                  [Uncategorized feedback — gap evaluation bypassed]
                </p>
                <p>
                  is_gap = <span className="font-semibold text-destructive">false</span>
                </p>
                <Badge className="mt-3 bg-muted text-muted-foreground">Not a gap (bypassed)</Badge>
              </>
            ) : (
              <>
                <p>
                  is_gap = ({mapping.rbt} ≤ {targetRbt}) AND (&quot;{mapping.clt}&quot; ==
                  &quot;Intrinsic&quot;)
                </p>
                <p>
                  is_gap = {String(mapping.rbt <= targetRbt)} AND{" "}
                  {String(mapping.clt === "Intrinsic")}
                </p>
                <p>
                  is_gap ={" "}
                  <span
                    className={cn(
                      "font-semibold",
                      mapping.isGap ? "text-emerald-600" : "text-destructive",
                    )}
                  >
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
              </>
            )}
          </div>
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
          <CardTitle>Phase 5 · Strategy Generation (Module 5)</CardTitle>
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
              P = (issue_count / Total_F) x w_c
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

  const rawRatio = (strategy.issueCount / strategy.totalFeedback) * 100;
  const pct = (strategy.priorityScore * 100).toFixed(0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phase 5 · Strategy Generation (Module 5)</CardTitle>
        <CardDescription>Unified priority scoring and threshold trigger.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="issue_count (Occurrences)"
            value={String(strategy.issueCount)}
            subvalue={`${rawRatio.toFixed(0)}% of cohort`}
          />
          <Stat label="Total_F (Total Feedback)" value={String(strategy.totalFeedback)} />
          <Stat
            label="w_c (Criticality Weight)"
            value={`${strategy.weightedCoefficient}x`}
            subvalue={strategy.isGap ? "1.5x gap multiplier" : "1.0x standard"}
          />
        </div>
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <p className="mb-2 text-sm font-medium">Priority score (P)</p>
          <p className="font-mono text-xs text-muted-foreground">
            P = (issue_count / Total_F) x w_c
          </p>
          <div className="mt-3 space-y-1.5 font-mono text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                P = ({strategy.issueCount} / {strategy.totalFeedback}) x{" "}
                {strategy.weightedCoefficient}
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                w_c = {strategy.isGap ? "1.5 (gap)" : "1.0 (non-gap)"}
              </Badge>
            </div>
            <p>
              P = {(strategy.issueCount / strategy.totalFeedback).toFixed(2)} x{" "}
              {strategy.weightedCoefficient}
            </p>
            <p>
              P = <span className="font-semibold text-primary">{pct}%</span>
            </p>
          </div>

          {/* Threshold bar */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>0%</span>
              <span className="font-mono font-medium text-foreground">
                threshold {Math.round(PRIORITY_THRESHOLD * 100)}%
              </span>
              <span>100%</span>
            </div>
            <div className="relative h-3 overflow-hidden rounded bg-muted">
              <div
                className={cn(
                  "h-full rounded transition-all",
                  strategy.triggersRecommendation ? "bg-primary" : "bg-warning",
                )}
                style={{ width: `${Math.min(strategy.priorityScore * 100, 100)}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground/70"
                style={{ left: `${PRIORITY_THRESHOLD * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <Badge
                className={cn(
                  strategy.triggersRecommendation
                    ? "bg-primary/10 text-primary"
                    : "bg-warning/10 text-warning",
                )}
              >
                {strategy.triggersRecommendation
                  ? `P ≥ ${(PRIORITY_THRESHOLD * 100).toFixed(0)}% → Recommendation (Phase 6)`
                  : `P < ${(PRIORITY_THRESHOLD * 100).toFixed(0)}% → Diagnostic Warning (Phase 6)`}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CueSegment {
  text: string;
  kind?: string;
}

function segmentCueParagraph(
  paragraph: string,
  terms: Array<{ text: string; kind: string }>,
): CueSegment[] {
  let segments: CueSegment[] = [{ text: paragraph }];
  for (const term of terms) {
    if (!term.text) continue;
    const next: CueSegment[] = [];
    for (const seg of segments) {
      if (seg.kind) {
        next.push(seg);
        continue;
      }
      const idx = seg.text.toLowerCase().indexOf(term.text.toLowerCase());
      if (idx === -1) {
        next.push(seg);
        continue;
      }
      const before = seg.text.slice(0, idx);
      const match = seg.text.slice(idx, idx + term.text.length);
      const after = seg.text.slice(idx + term.text.length);
      if (before) next.push({ text: before });
      next.push({ text: match, kind: term.kind });
      if (after) next.push({ text: after });
    }
    segments = next;
  }
  return segments;
}

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
          <CardTitle>Phase 6 · Dashboard Output (Module 6)</CardTitle>
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
  const pct = (strategy.priorityScore * 100).toFixed(0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phase 6 · Dashboard Output (Module 6)</CardTitle>
        <CardDescription>
          {isRecommendation
            ? "Threshold met — full pedagogical recommendation cue generated."
            : "Threshold not met — passive diagnostic warning monitor."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Issue → Recommendation Mapping Table */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Issue → Recommendation Mapping (Module 6 Table)</Label>
            <span className="text-[11px] text-muted-foreground">
              Active match highlighted from predicted issue
            </span>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="max-h-60 overflow-y-auto overflow-x-auto pb-2 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="sticky top-0 z-10 w-40 min-w-[10rem] bg-muted/95 p-2 text-left font-medium backdrop-blur-sm">
                      Issue
                    </th>
                    <th className="sticky top-0 z-10 bg-muted/95 p-2 text-left font-medium backdrop-blur-sm">
                      Pedagogical Recommendation
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ALL_TAXONOMY_ISSUES.map((key) => {
                    const name = ISSUE_RULES[key] ?? key;
                    const rec = ISSUE_RECOMMENDATIONS[key] ?? "—";
                    const isMatched =
                      cue.issue.toLowerCase() === key.toLowerCase() ||
                      cue.issue.toLowerCase() === name.toLowerCase();
                    return (
                      <tr
                        key={key}
                        className={cn(
                          "transition-colors",
                          isMatched
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-muted-foreground/80 hover:bg-muted/40",
                        )}
                      >
                        <td className="w-40 min-w-[10rem] p-2 font-mono">{name}</td>
                        <td className="p-2 font-sans leading-relaxed">{rec}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isRecommendation ? (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Synthesized Recommendation Cue
              </span>
            </div>
            <div className="text-sm leading-relaxed text-muted-foreground">
              <p>
                {segmentCueParagraph(cue.paragraph, cue.terms).map((seg, i) => {
                  if (!seg.kind) return <span key={i}>{seg.text}</span>;
                  if (seg.kind === "prevalence") {
                    return (
                      <span key={i} className="font-mono font-semibold text-foreground">
                        {seg.text}
                      </span>
                    );
                  }
                  if (seg.kind === "ILO") {
                    return (
                      <span key={i} className="italic text-foreground">
                        &ldquo;{seg.text}&rdquo;
                      </span>
                    );
                  }
                  // issue, TTI, RBT, CLT, recommendation, topic — all get the same underline highlight
                  return (
                    <span
                      key={i}
                      className="font-medium text-foreground underline decoration-primary/50 underline-offset-4"
                    >
                      {seg.text}
                    </span>
                  );
                })}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold">Diagnostic Warning Monitor</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Low-prevalence diagnostic alert —{" "}
              <span className="font-mono font-semibold text-foreground">{pct}%</span> of the class
              is experiencing{" "}
              <span className="font-medium text-foreground underline decoration-warning/50 underline-offset-4">
                {cue.issue}
              </span>
              . Below the 30% recommendation threshold; no instructional intervention is triggered.
              Monitor in the next session.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  mono,
  preWrap,
}: {
  label: string;
  value: string;
  mono?: boolean;
  preWrap?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[240px_1fr] sm:items-start sm:gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 break-words font-medium sm:text-right",
          mono && "font-mono",
          preWrap && "whitespace-pre-wrap",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  subvalue,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  subvalue?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {subvalue && (
          <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {subvalue}
          </span>
        )}
      </div>
      <p className={cn("mt-1 text-sm font-semibold", highlight && "text-emerald-600")}>{value}</p>
    </div>
  );
}
