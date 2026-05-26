import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { getMLWorker } from "@/lib/mlWorkerStore";
import { CheckCircle2, Download, Loader2 } from "lucide-react";

interface ModelLoaderOverlayProps {
  isVisible: boolean;
}

export function ModelLoaderOverlay({ isVisible }: ModelLoaderOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing Machine Learning Engine...");
  const [isCached, setIsCached] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setStatusText("Initializing Machine Learning Engine...");
      setIsCached(false);
      setHasStarted(false);
      return;
    }

    const { worker, api } = getMLWorker();

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "progress") {
        const info = e.data.data;
        setHasStarted(true);

        if (info.status === "ready") {
          setIsCached(true);
          setProgress(100);
          setStatusText("Cached Load Successful");
        } else if (info.status === "download") {
          setStatusText(`Downloading Model Weights... (${info.file})`);
        } else if (info.status === "progress") {
          setProgress(info.progress);
        } else if (info.status === "done") {
          if (!isCached) {
            setStatusText("Compiling WASM/SIMD Kernels...");
            setProgress(100);
          }
        }
      }
    };

    worker.addEventListener("message", handleMessage);

    // Trigger preloading
    api.preloadModel().catch((err) => {
      console.error("Failed to preload model:", err);
      setStatusText("Error loading model.");
    });

    return () => {
      worker.removeEventListener("message", handleMessage);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="mx-4 flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-2xl backdrop-blur-xl duration-300 animate-in fade-in zoom-in-95">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/30">
          {isCached ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-500 animate-in zoom-in" />
          ) : hasStarted && progress > 0 && progress < 100 ? (
            <Download className="h-8 w-8 animate-pulse text-primary" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}
        </div>
        
        <h3 className="mb-2 text-lg font-semibold tracking-tight text-card-foreground">
          {isCached ? "Ready for Inference" : "Loading NLP Model"}
        </h3>
        
        <p className="mb-6 text-sm text-muted-foreground min-h-10 max-w-xs">
          {statusText}
        </p>

        {!isCached && (
          <div className="w-full space-y-2">
            <Progress value={progress} className="h-2 w-full bg-primary/20 [&>div]:bg-primary" />
            <div className="flex justify-end text-xs text-muted-foreground font-mono">
              {progress.toFixed(0)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
