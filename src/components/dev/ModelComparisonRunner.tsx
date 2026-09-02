import { useState, useCallback, useRef, useEffect } from "react";
import {
  MODEL_KINDS,
  IDLE_PROGRESS,
  loadPersistedState,
  persistComparisonState,
  loadTestSet,
  clearModelCaches,
  runColdStart,
  runRest,
  runColdTTFR,
  runWarmTTFR,
  type TestCase,
  type ModelComparisonResult,
  type ComparisonProgress,
} from "./modelComparisonUtils";

export function useModelComparison() {
  const [initial] = useState(loadPersistedState);
  const [results, setResults] = useState<ModelComparisonResult[]>(initial?.results ?? []);

  useEffect(() => {
    persistComparisonState(results);
  }, [results]);

  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [progress, setProgress] = useState<ComparisonProgress>(IDLE_PROGRESS);
  const cancelRef = useRef<AbortController | null>(null);

  const runComparison = useCallback(async (testSet: TestCase[]) => {
    const controller = new AbortController();
    cancelRef.current = controller;
    const kinds: (typeof MODEL_KINDS)[number][] = [...MODEL_KINDS];
    const texts = testSet.map((t) => t.text);
    const partial: ModelComparisonResult[] = [];
    setLoading(true);
    setResults([]);

    try {
      await clearModelCaches();

      for (let i = 0; i < kinds.length; i++) {
        if (controller.signal.aborted) break;
        const kind = kinds[i];
        setCurrentModel(kind);
        setProgress({ stage: "Downloading model…", current: 0, total: 0, bytes: undefined });

        // Per-model fail-safe: a single model failure must not abort the whole
        // pipeline or wipe previously computed results.
        try {
          const cold = await runColdStart(
            kind,
            controller.signal,
            (loaded: number, total: number, phase?: string) => {
              setProgress((prev) => ({
                ...prev,
                bytes: loaded > 0 ? { loaded, total } : prev.bytes,
                stage: phase === "download" || !phase ? "Downloading model…" : "Preparing model…",
              }));
            },
          );

          setProgress({ stage: "Loading model…", current: 0, total: 0 });
          const rest = await runRest(
            kind,
            texts,
            (stage, current, total) => {
              setProgress({ stage, current, total });
            },
            controller.signal,
          );

          // End-to-end time-to-first-result, separate from per-sample latency.
          setProgress({ stage: "Measuring cold time-to-first-result…", current: 0, total: 0 });
          const coldTTFRMs = await runColdTTFR(kind, texts[0], controller.signal);
          setProgress({ stage: "Measuring warm time-to-first-result…", current: 0, total: 0 });
          const warmTTFRMs = await runWarmTTFR(kind, texts[0], controller.signal);

          partial.push({ modelName: kind, ...cold, ...rest, coldTTFRMs, warmTTFRMs });
        } catch (err) {
          if (controller.signal.aborted) break;
          console.error(`[ModelComparison] Comparison failed for ${kind}:`, err);
          partial.push({
            modelName: kind,
            error: err instanceof Error ? err.message : String(err),
            coldStartMs: 0,
            coldPeakJSHeapMB: 0,
            warmStartMs: 0,
            avgLatencyMs: 0,
            p50LatencyMs: 0,
            p95LatencyMs: 0,
            peakJSHeapMB: 0,
            coldTTFRMs: 0,
            warmTTFRMs: 0,
          });
        }
        setResults([...partial]);
      }
    } finally {
      cancelRef.current = null;
      setLoading(false);
      setCurrentModel(null);
      setProgress(IDLE_PROGRESS);
    }
  }, []);

  const cancel = useCallback(async () => {
    cancelRef.current?.abort();
    await clearModelCaches();
    setResults([]);
    cancelRef.current = null;
    setLoading(false);
    setCurrentModel(null);
    setProgress(IDLE_PROGRESS);
  }, []);

  return {
    results,
    loading,
    currentModel,
    progress,
    runComparison,
    cancel,
  };
}

// Re-export types for consumers
export type { TestCase, ModelComparisonResult, ComparisonProgress } from "./modelComparisonUtils";
export { loadTestSet, clearModelCaches, MODEL_KINDS } from "./modelComparisonUtils";
