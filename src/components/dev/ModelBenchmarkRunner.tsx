import { useState, useCallback } from "react";
import { createModel, type ModelAdapter, type ModelKind } from "@/lib/algorithm/models";
import { terminateMLWorker } from "@/lib/ml/mlWorkerStore";

export interface TestCase {
  id: string;
  text: string;
  expectedIssue: string;
}

export interface ModelBenchmarkResult {
  modelName: string;
  macroF1: number;
  macroPrecision: number;
  macroRecall: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  loadTimeMs: number;
  loadMemoryMB: number;
  inferenceMemoryMB: number;
  residualMemoryMB: number;
  predictions: PredictionDetail[];
}

export interface PredictionDetail {
  sampleId: string;
  predicted: string;
  expected: string;
  correct: boolean;
}

interface PerformanceWithMemory extends Performance {
  measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
  memory?: { usedJSHeapSize: number };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function measureMemory(): Promise<number> {
  const perf = performance as PerformanceWithMemory;
  try {
    const mem = await perf.measureUserAgentSpecificMemory?.();
    if (mem) return mem.bytes;
  } catch {
    // ignore
  }
  return perf.memory?.usedJSHeapSize ?? 0;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function calculateMacroMetrics(
  predictions: string[],
  expected: string[],
  labels: string[],
): { macroPrecision: number; macroRecall: number; macroF1: number } {
  let macroPrecision = 0;
  let macroRecall = 0;
  let macroF1 = 0;

  for (const label of labels) {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === label && expected[i] === label) tp++;
      else if (predictions[i] === label) fp++;
      else if (expected[i] === label) fn++;
    }
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = precision && recall ? (2 * precision * recall) / (precision + recall) : 0;
    macroPrecision += precision;
    macroRecall += recall;
    macroF1 += f1;
  }

  const n = labels.length;
  return {
    macroPrecision: macroPrecision / n,
    macroRecall: macroRecall / n,
    macroF1: macroF1 / n,
  };
}

interface ProgressCallback {
  (stage: string, current: number, total: number): void;
}

async function runModelBenchmark(
  kind: ModelKind,
  testSet: TestCase[],
  onProgress?: ProgressCallback,
): Promise<ModelBenchmarkResult> {
  const model = createModel(kind);

  const baselineMem = await measureMemory();

  onProgress?.("Loading model...", 0, testSet.length + 2);
  const loadStart = performance.now();
  await model.load();
  const loadTimeMs = performance.now() - loadStart;

  const afterLoadMem = await measureMemory();
  const loadMemoryMB = (afterLoadMem - baselineMem) / 1024 / 1024;

  onProgress?.("Warming up...", 0, testSet.length + 2);
  for (let i = 0; i < Math.min(3, testSet.length); i++) {
    await model.predict(testSet[i].text);
  }

  onProgress?.("Running inference...", 0, testSet.length);
  const latencies: number[] = [];
  const predictions: string[] = [];
  const expected: string[] = [];
  const predictionDetails: PredictionDetail[] = [];

  for (let i = 0; i < testSet.length; i++) {
    onProgress?.(`Running inference...`, i + 1, testSet.length);
    const t0 = performance.now();
    const result = await model.predict(testSet[i].text);
    latencies.push(performance.now() - t0);
    predictions.push(result.issue);
    expected.push(testSet[i].expectedIssue);
    predictionDetails.push({
      sampleId: testSet[i].id,
      predicted: result.issue,
      expected: testSet[i].expectedIssue,
      correct: result.issue === testSet[i].expectedIssue,
    });
  }

  const afterInferenceMem = await measureMemory();
  const inferenceMemoryMB = (afterInferenceMem - afterLoadMem) / 1024 / 1024;

  onProgress?.("Disposing model...", testSet.length, testSet.length);
  await model.dispose();
  terminateMLWorker();
  await sleep(1500);

  const afterDisposeMem = await measureMemory();
  const residualMemoryMB = Math.max(0, (afterDisposeMem - baselineMem) / 1024 / 1024);

  const uniqueLabels = Array.from(new Set([...predictions, ...expected]));
  const { macroPrecision, macroRecall, macroF1 } = calculateMacroMetrics(
    predictions,
    expected,
    uniqueLabels,
  );

  return {
    modelName: kind,
    macroF1,
    macroPrecision,
    macroRecall,
    avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    loadTimeMs,
    loadMemoryMB,
    inferenceMemoryMB,
    residualMemoryMB,
    predictions: predictionDetails,
  };
}

export function useModelBenchmark() {
  const [results, setResults] = useState<ModelBenchmarkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [progress, setProgress] = useState({ stage: "", current: 0, total: 0 });

  const runAll = useCallback(async (testSet: TestCase[]) => {
    const kinds: ModelKind[] = ["distilxlmr", "mdeberta", "mbert", "svm"];
    const allResults: ModelBenchmarkResult[] = [];
    setLoading(true);

    for (const kind of kinds) {
      setCurrentModel(kind);
      setProgress({ stage: `Loading ${kind}...`, current: 0, total: testSet.length + 2 });
      const result = await runModelBenchmark(kind, testSet, (stage, current, total) => {
        setProgress({ stage, current, total });
      });
      allResults.push(result);
      setResults([...allResults]);
    }

    setLoading(false);
    setCurrentModel(null);
    setProgress({ stage: "Complete", current: testSet.length, total: testSet.length });
  }, []);

  return { results, loading, currentModel, progress, runAll };
}
