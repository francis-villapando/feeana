import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  Download,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/hooks/utils";

interface LoadProgressData {
  progress: number;
  phase?: string;
  source?: "cache" | "network";
  bytes?: {
    loaded: number;
    total: number;
  };
}

interface ModelLoaderOverlayProps {
  isVisible: boolean;
  loadProgress: LoadProgressData;
  inferenceProgress: { current: number; total: number; text: string } | null;
  onCancel?: () => void;
}

type StepState = "done" | "active" | "pending";

function StepChip({ state, label }: { state: StepState; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        state === "done" && "bg-emerald-500/10 text-emerald-500",
        state === "active" && "bg-primary/10 text-primary",
        state === "pending" && "bg-muted/60 text-muted-foreground",
      )}
    >
      {state === "done" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : state === "active" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
      )}
      {label}
    </span>
  );
}

function DeterminateBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary/40 to-primary"
        style={{
          width: `${clamped}%`,
          transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}

function IndeterminateBar({ label }: { label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-busy="true"
      className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20"
    >
      <div className="animate-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-primary/40 to-primary" />
    </div>
  );
}

export function ModelLoaderOverlay({
  isVisible,
  loadProgress,
  inferenceProgress,
  onCancel,
}: ModelLoaderOverlayProps) {
  if (!isVisible) return null;

  const isClassifying = inferenceProgress !== null;
  const isEngineReady = loadProgress.progress === 100 && !isClassifying;
  const isIndeterminate = loadProgress.progress === 0 && !isClassifying && !isEngineReady;

  const { phase, source } = loadProgress;

  const getHeadline = () => {
    if (isClassifying) return "Analyzing feedback…";
    if (isEngineReady) return "AI engine is ready";
    if (source === "network") return "Downloading the AI engine…";
    if (phase === "download") {
      return source === "cache" ? "Loading the AI engine…" : "Downloading the AI engine…";
    }
    switch (phase) {
      case "session":
        return "Warming up the AI engine…";
      case "tokenizer":
      case "labels":
        return "Preparing the AI engine…";
      default:
        return "Preparing your analysis…";
    }
  };

  const getDetail = () => {
    if (isClassifying) return null;
    if (isEngineReady) {
      return "The AI engine is saved on this device — future analyses start instantly.";
    }
    if (source === "cache") {
      return "Loading the AI engine from local device cache…";
    }
    if (source === "network" || phase === "download") {
      return "The AI engine will be saved locally so future analyses run offline and immediately.";
    }
    return "Initializing the AI engine in your browser…";
  };

  const getIcon = () => {
    if (isClassifying) return <Sparkles className="h-8 w-8 text-primary animate-pulse" />;
    if (isEngineReady)
      return <CheckCircle2 className="h-8 w-8 text-emerald-500 animate-in zoom-in" />;
    if (phase === "download") return <Download className="h-8 w-8" />;
    if (isIndeterminate) {
      return (
        <span className="inline-flex animate-spin">
          <Loader2 className="h-8 w-8 text-primary" />
        </span>
      );
    }
    switch (phase) {
      case "session":
        return <Cpu className="h-8 w-8 animate-pulse" />;
      case "tokenizer":
        return <BookOpen className="h-8 w-8 animate-pulse" />;
      case "labels":
        return <Database className="h-8 w-8 animate-pulse" />;
      default:
        return (
          <span className="inline-flex animate-spin">
            <Loader2 className="h-8 w-8 text-primary" />
          </span>
        );
    }
  };

  const headline = getHeadline();
  const detail = getDetail();
  const stepOneDone = isEngineReady || isClassifying;
  const inferencePct =
    isClassifying && inferenceProgress && inferenceProgress.total > 0
      ? (inferenceProgress.current / inferenceProgress.total) * 100
      : 0;

  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
  const downloadPct =
    loadProgress.bytes && loadProgress.bytes.total > 0
      ? (loadProgress.bytes.loaded / loadProgress.bytes.total) * 100
      : loadProgress.progress;
  const showDownloadBytes =
    source === "network" && loadProgress.bytes && loadProgress.bytes.total > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ml-overlay-title"
        aria-describedby={detail ? "ml-overlay-desc" : undefined}
        className="mx-4 flex min-h-[280px] w-full max-w-md flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-2xl backdrop-blur-md duration-300 animate-in fade-in zoom-in-95"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 shadow-inner">
          {getIcon()}
        </div>

        <h3
          id="ml-overlay-title"
          aria-live="polite"
          className="mb-2 min-h-7 w-full text-lg font-semibold tracking-tight text-card-foreground line-clamp-1"
        >
          <span key={headline} className="inline-block animate-in fade-in duration-300">
            {headline}
          </span>
        </h3>

        <div className="mb-4 flex items-center gap-2">
          <StepChip state={stepOneDone ? "done" : "active"} label="AI engine" />
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <StepChip state={isClassifying ? "active" : "pending"} label="Feedback analysis" />
        </div>

        <div className="flex min-h-[92px] w-full flex-col items-center gap-3">
          {isClassifying && inferenceProgress ? (
            <>
              <div className="flex h-[52px] w-full items-center overflow-hidden rounded-md border border-border/50 bg-muted/50 px-3 text-left text-xs italic text-muted-foreground shadow-sm">
                <span className="line-clamp-2">"{inferenceProgress.text}…"</span>
              </div>
              <div className="w-full">
                <DeterminateBar value={inferencePct} label="Feedback analysis progress" />
                <div className="mt-1 flex w-full justify-between text-xs font-mono text-muted-foreground">
                  <span>{Math.round(inferencePct)}%</span>
                  <span>
                    {inferenceProgress.current} / {inferenceProgress.total}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {detail && (
                <p
                  id="ml-overlay-desc"
                  key={detail}
                  aria-live="polite"
                  className="min-h-10 w-full max-w-xs text-sm text-muted-foreground line-clamp-2 animate-in fade-in duration-300"
                >
                  {detail}
                </p>
              )}
              <div className="w-full">
                {isIndeterminate ? (
                  <IndeterminateBar label="AI engine setup progress" />
                ) : (
                  <>
                    <DeterminateBar
                      value={loadProgress.progress}
                      label="AI engine setup progress"
                    />
                    <div className="mt-1 flex w-full justify-between text-xs font-mono text-muted-foreground">
                      <span>{Math.round(loadProgress.progress)}%</span>
                      {showDownloadBytes && loadProgress.bytes ? (
                        <span>
                          {formatMb(loadProgress.bytes.loaded)} MB /{" "}
                          {formatMb(loadProgress.bytes.total)} MB ({Math.round(downloadPct)}%)
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="mt-4 w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="mr-2 h-4 w-4" /> Cancel analysis
          </Button>
        )}
      </div>
    </div>
  );
}
