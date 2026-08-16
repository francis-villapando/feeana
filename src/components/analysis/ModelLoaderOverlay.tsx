import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Sparkles, X, Database, Cpu, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadProgressData {
  progress: number;
  phase?: string;
}

interface ModelLoaderOverlayProps {
  isVisible: boolean;
  loadProgress: LoadProgressData;
  inferenceProgress: { current: number; total: number; text: string } | null;
  statusText: string;
  onCancel?: () => void;
}

export function ModelLoaderOverlay({
  isVisible,
  loadProgress,
  inferenceProgress,
  statusText,
  onCancel,
}: ModelLoaderOverlayProps) {
  if (!isVisible) return null;

  const isClassifying = inferenceProgress !== null;
  const isCached = loadProgress.progress === 100 && !isClassifying;
  const isLoading = loadProgress.progress === 0 && !isClassifying && !isCached;

  const getPhaseIcon = (phase?: string) => {
    switch (phase) {
      case "session":
        return <Cpu className="h-4 w-4 animate-pulse" />;
      case "tokenizer":
        return <FileText className="h-4 w-4 animate-pulse" />;
      case "labels":
        return <Database className="h-4 w-4 animate-pulse" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getPhaseLabel = (phase?: string) => {
    switch (phase) {
      case "session":
        return "Initializing inference engine";
      case "tokenizer":
        return "Loading tokenizer";
      case "labels":
        return "Loading label mappings";
      default:
        return "Loading NLP model";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="mx-4 flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-2xl backdrop-blur-md duration-300 animate-in fade-in zoom-in-95">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 shadow-inner">
          {isClassifying ? (
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          ) : isCached ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-500 animate-in zoom-in" />
          ) : isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            getPhaseIcon(loadProgress.phase)
          )}
        </div>

        <h3 className="mb-2 text-lg font-semibold tracking-tight text-card-foreground">
          {isClassifying
            ? "Classifying feedback…"
            : isCached
              ? "Engine ready"
              : isLoading
                ? "Loading NLP model…"
                : getPhaseLabel(loadProgress.phase)}
        </h3>

        <p className="mb-6 text-sm text-muted-foreground min-h-10 max-w-xs">{statusText}</p>

        {isClassifying && inferenceProgress ? (
          <div className="w-full space-y-3">
            <div className="flex justify-between text-xs font-medium text-foreground">
              <span>
                {Math.round((inferenceProgress.current / inferenceProgress.total) * 100)}%
              </span>
              <span>
                {inferenceProgress.current} / {inferenceProgress.total}
              </span>
            </div>
            <Progress
              value={(inferenceProgress.current / inferenceProgress.total) * 100}
              className="h-2 w-full bg-primary/20 [&>div]:bg-gradient-to-r [&>div]:from-primary/40 [&>div]:to-primary"
            />
            <div className="rounded-md bg-muted/50 p-3 text-left text-xs italic text-muted-foreground line-clamp-2 border border-border/50 shadow-sm">
              "{inferenceProgress.text}…"
            </div>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="mt-2 w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="mr-2 h-4 w-4" /> Cancel analysis
              </Button>
            )}
          </div>
        ) : isLoading ? (
          <div className="w-full space-y-2" aria-live="polite">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
              <div className="animate-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-primary/40 to-primary" />
            </div>
            <div className="flex justify-end text-xs text-muted-foreground font-mono">
              {getPhaseLabel(loadProgress.phase)}…
            </div>
          </div>
        ) : !isCached ? (
          <div className="w-full space-y-2">
            <Progress
              value={loadProgress.progress}
              className="h-2 w-full bg-primary/20 [&>div]:bg-gradient-to-r [&>div]:from-primary/40 [&>div]:to-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>{getPhaseLabel(loadProgress.phase)}</span>
              <span>{(loadProgress.progress ?? 0).toFixed(0)}%</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
