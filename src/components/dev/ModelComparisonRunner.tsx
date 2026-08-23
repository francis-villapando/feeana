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
  type RestMetrics,
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
        setProgress({ stage: `Downloading ${kind}…`, current: 0, total: 0, bytes: undefined });
        let cold: { coldStartMs: number; coldPeakJSHeapMB: number };
        try {
          cold = await runColdStart(kind, controller.signal, (loaded: number, total: number) => {
            setProgress((prev) => ({ ...prev, bytes: { loaded, total } }));
          });
        } catch (err) {
          if (controller.signal.aborted) break;
          console.error(`[ModelComparison] Cold start failed for ${kind}:`, err);
          throw new Error(
            `Cold start failed for ${kind}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        setProgress({ stage: `Loading ${kind}…`, current: 0, total: 0 });
        let rest: RestMetrics;
        try {
          rest = await runRest(
            kind,
            texts,
            (stage, current, total) => {
              setProgress({ stage, current, total });
            },
            controller.signal,
          );
        } catch (err) {
          if (controller.signal.aborted) break;
          console.error(`[ModelComparison] Remaining comparison failed for ${kind}:`, err);
          throw new Error(
            `Remaining comparison failed for ${kind}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        partial.push({ modelName: kind, ...cold, ...rest });
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
