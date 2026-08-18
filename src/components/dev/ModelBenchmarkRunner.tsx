import { useState, useCallback } from "react";
import * as Comlink from "comlink";
import Papa from "papaparse";
import type { ModelKind } from "@/lib/algorithm/models";
import type { BenchmarkWorkerApi } from "@/lib/ml/benchmarkWorker";

export interface TestCase {
  id: string;
  text: string;
  expectedIssue: string;
}

interface TestSetRow {
  id: string;
  text: string;
  issue: string;
}

export async function loadTestSet(): Promise<TestCase[]> {
  const res = await fetch("/model-data/test.csv");
  if (!res.ok) throw new Error("Failed to load test set");
  const csv = await res.text();
  const parsed = Papa.parse<TestSetRow>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`Failed to parse test set: ${parsed.errors[0].message}`);
  }
  return parsed.data.map((row) => ({
    id: String(row.id),
    text: row.text,
    expectedIssue: row.issue,
  }));
}

export interface ModelBenchmarkResult {
  modelName: string;
  macroF1: number;
  macroPrecision: number;
  macroRecall: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  coldStartMs: number;
  peakJSHeapMB: number;
  predictions: PredictionDetail[];
}

export interface PredictionDetail {
  sampleId: string;
  predicted: string;
  expected: string;
  correct: boolean;
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

interface BenchmarkProgress {
  stage: string;
  current: number;
  total: number;
  modelIndex: number;
  modelCount: number;
}

const MEMORY_SAMPLE_INTERVAL_MS = 50;

interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number };
}

async function sampleCurrentJSHeapBytes(): Promise<number> {
  const perf = performance as PerformanceWithMemory;
  try {
    const mem = await (
      perf as PerformanceWithMemory & {
        measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
      }
    ).measureUserAgentSpecificMemory?.();
    if (mem) return mem.bytes;
  } catch {
    // ignore
  }
  return perf.memory?.usedJSHeapSize ?? 0;
}

function createBenchmarkWorker(): {
  worker: Worker;
  api: Comlink.Remote<BenchmarkWorkerApi>;
} {
  const worker = new Worker(new URL("../../lib/ml/benchmarkWorker.ts", import.meta.url), {
    type: "module",
  });
  return { worker, api: Comlink.wrap<BenchmarkWorkerApi>(worker) };
}

async function runModelBenchmark(
  kind: ModelKind,
  testSet: TestCase[],
  onProgress?: ProgressCallback,
): Promise<ModelBenchmarkResult> {
  const { worker, api } = createBenchmarkWorker();

  let peakJSHeapBytes = 0;
  const sampler = setInterval(async () => {
    const bytes = await sampleCurrentJSHeapBytes();
    if (bytes > peakJSHeapBytes) peakJSHeapBytes = bytes;
  }, MEMORY_SAMPLE_INTERVAL_MS);

  try {
    onProgress?.("Loading model…", 0, 0);
    const { coldStartMs } = await api.loadModel(kind);

    onProgress?.("Warming up…", 0, 0);
    const texts = testSet.map((t) => t.text);
    const { predictions, latencies } = await api.runBenchmark(
      texts,
      Comlink.proxy((current: number, total: number) =>
        onProgress?.("Running inference…", current, total),
      ),
    );

    const predictionDetails: PredictionDetail[] = testSet.map((t, i) => {
      const predicted = predictions[i].issue.toLowerCase();
      const expectedLabel = t.expectedIssue.toLowerCase();
      return {
        sampleId: t.id,
        predicted,
        expected: expectedLabel,
        correct: predicted === expectedLabel,
      };
    });

    const predLabels = predictionDetails.map((p) => p.predicted);
    const expectedLabels = predictionDetails.map((p) => p.expected);
    const uniqueLabels = Array.from(new Set([...predLabels, ...expectedLabels]));
    const { macroPrecision, macroRecall, macroF1 } = calculateMacroMetrics(
      predLabels,
      expectedLabels,
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
      coldStartMs,
      peakJSHeapMB: peakJSHeapBytes / 1024 / 1024,
      predictions: predictionDetails,
    };
  } finally {
    clearInterval(sampler);
    const finalBytes = await sampleCurrentJSHeapBytes();
    if (finalBytes > peakJSHeapBytes) peakJSHeapBytes = finalBytes;
    await api.disposeModel();
    worker.terminate();
  }
}

export function useModelBenchmark() {
  const [results, setResults] = useState<ModelBenchmarkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [progress, setProgress] = useState<BenchmarkProgress>({
    stage: "",
    current: 0,
    total: 0,
    modelIndex: 0,
    modelCount: 0,
  });

  const runAll = useCallback(async (testSet: TestCase[]) => {
    const kinds: ModelKind[] = ["distilxlmr", "mbert", "svm"];
    const allResults: ModelBenchmarkResult[] = [];
    setLoading(true);

    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[i];
      const modelIndex = i + 1;
      setCurrentModel(kind);
      setProgress({
        stage: `Loading ${kind}…`,
        current: 0,
        total: 0,
        modelIndex,
        modelCount: kinds.length,
      });
      const result = await runModelBenchmark(kind, testSet, (stage, current, total) => {
        setProgress({ stage, current, total, modelIndex, modelCount: kinds.length });
      });
      allResults.push(result);
      setResults([...allResults]);
    }

    setLoading(false);
    setCurrentModel(null);
    setProgress({
      stage: "Complete",
      current: testSet.length,
      total: testSet.length,
      modelIndex: kinds.length,
      modelCount: kinds.length,
    });
  }, []);

  return { results, loading, currentModel, progress, runAll };
}
