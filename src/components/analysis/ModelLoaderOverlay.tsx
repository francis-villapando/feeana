import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Download, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModelLoaderOverlayProps {
  isVisible: boolean;
  downloadProgress: number; // 0 to 100
  inferenceProgress: { current: number; total: number; text: string } | null;
  statusText: string;
  onCancel?: () => void;
}

export function ModelLoaderOverlay({
  isVisible,
  downloadProgress,
  inferenceProgress,
  statusText,
  onCancel,
}: ModelLoaderOverlayProps) {
  if (!isVisible) return null;

  const isDownloading = downloadProgress > 0 && downloadProgress < 100;
  const isClassifying = inferenceProgress !== null;
  const isCached = downloadProgress === 100 && !isClassifying;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="mx-4 flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-2xl backdrop-blur-xl duration-300 animate-in fade-in zoom-in-95">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 shadow-inner">
          {isClassifying ? (
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          ) : isCached ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-500 animate-in zoom-in" />
          ) : isDownloading ? (
            <Download className="h-8 w-8 animate-bounce text-primary" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}
        </div>
        
        <h3 className="mb-2 text-lg font-semibold tracking-tight text-card-foreground">
          {isClassifying ? "Classifying Feedback" : isCached ? "Engine Ready" : "Loading NLP Model"}
        </h3>
        
        <p className="mb-6 text-sm text-muted-foreground min-h-10 max-w-xs">
          {statusText}
        </p>

        {isClassifying && inferenceProgress ? (
          <div className="w-full space-y-3">
            <div className="flex justify-between text-xs font-medium text-foreground">
              <span>{Math.round((inferenceProgress.current / inferenceProgress.total) * 100)}%</span>
              <span>{inferenceProgress.current} / {inferenceProgress.total}</span>
            </div>
            <Progress 
              value={(inferenceProgress.current / inferenceProgress.total) * 100} 
              className="h-2 w-full bg-primary/20 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-indigo-400" 
            />
            <div className="rounded-md bg-muted/50 p-3 text-left text-xs italic text-muted-foreground line-clamp-2 border border-border/50 shadow-sm">
              "{inferenceProgress.text}..."
            </div>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel} className="mt-2 w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <X className="mr-2 h-4 w-4" /> Cancel Analysis
              </Button>
            )}
          </div>
        ) : !isCached ? (
          <div className="w-full space-y-2">
            <Progress value={downloadProgress} className="h-2 w-full bg-primary/20 [&>div]:bg-primary" />
            <div className="flex justify-end text-xs text-muted-foreground font-mono">
              {downloadProgress.toFixed(0)}%
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
