import * as Comlink from "comlink";
import Papa from "papaparse";
import type { ModelKind } from "@/lib/algorithm/models";
import type { ComparisonWorkerApi } from "@/lib/ml/comparisonWorker";

export const MODEL_KINDS = ["distilxlmr", "mbert", "svm"] as const;

export const MODEL_CACHE_KEYS = [
  "feeana-model-cache-v1",
  "feeana-model-cache-mbert-v1",
  "feeana-model-cache-svm-v1",
  "transformers-cache",
];

export const STORAGE_KEY = "feeana-comparison-progress-v1";
export const STORAGE_VERSION = 3;

export const RESULT_KEYS = [
  "coldStartMs",
  "coldPeakJSHeapMB",
  "warmStartMs",
  "avgLatencyMs",
  "p50LatencyMs",
  "p95LatencyMs",
  "peakJSHeapMB",
] as const;

export interface PersistedComparisonState {
  version: number;
  results: ModelComparisonResult[];
}

function isValidEntry(r: object, keys: readonly string[]): boolean {
  const rec = r as Record<string, unknown>;
  return (
    (MODEL_KINDS as readonly string[]).includes(rec.modelName as string) &&
    keys.every((k) => typeof rec[k] === "number" && Number.isFinite(rec[k]))
  );
}

export function loadPersistedState(): PersistedComparisonState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedComparisonState;
    if (parsed.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(parsed.results)) return null;
    if (!parsed.results.every((r) => isValidEntry(r, RESULT_KEYS))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistComparisonState(results: ModelComparisonResult[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, results }));
  } catch {
    // ignore quota/private-mode failures
  }
}

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
  return parsed.data
    .map((row) => ({
      id: String(row.id),
      text: row.text,
      expectedIssue: row.issue,
    }))
    .slice(0, 50);
}

export async function clearModelCaches(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  const cleared: string[] = [];
  for (const key of MODEL_CACHE_KEYS) {
    try {
      if (await caches.delete(key)) cleared.push(key);
    } catch {
      // ignore
    }
  }
  return cleared;
}

export interface ModelComparisonResult {
  modelName: ModelKind;
  coldStartMs: number;
  coldPeakJSHeapMB: number;
  warmStartMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  peakJSHeapMB: number;
}

export interface RestMetrics {
  warmStartMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  peakJSHeapMB: number;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

interface ProgressCallback {
  (stage: string, current: number, total: number): void;
}

export interface ComparisonProgress {
  stage: string;
  current: number;
  total: number;
  bytes?: { loaded: number; total: number };
}

interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number };
}

interface MemoryAttribution {
  bytes: number;
}

type MeasureUserAgentSpecificMemory = () => Promise<MemoryAttribution>;

const MEMORY_SAMPLE_INTERVAL_MS = 50;

async function sampleHeapBytes(): Promise<number> {
  try {
    if (
      typeof crossOriginIsolated !== "undefined" &&
      crossOriginIsolated &&
      typeof (
        performance as PerformanceWithMemory & {
          measureUserAgentSpecificMemory?: MeasureUserAgentSpecificMemory;
        }
      ).measureUserAgentSpecificMemory === "function"
    ) {
      const sample = await (
        performance as PerformanceWithMemory & {
          measureUserAgentSpecificMemory: MeasureUserAgentSpecificMemory;
        }
      ).measureUserAgentSpecificMemory();
      return sample.bytes;
    }
  } catch {
    // fall through
  }
  const perf = performance as PerformanceWithMemory;
  try {
    return perf.memory?.usedJSHeapSize ?? 0;
  } catch {
    return 0;
  }
}

class HeapSampler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private peakBytes = 0;
  private sampling = false;

  async start(): Promise<void> {
    this.peakBytes = 0;
    if (this.timer) clearInterval(this.timer);
    const initial = await sampleHeapBytes();
    if (initial > this.peakBytes) this.peakBytes = initial;

    this.timer = setInterval(async () => {
      if (this.sampling) return;
      this.sampling = true;
      try {
        const bytes = await sampleHeapBytes();
        if (bytes > this.peakBytes) this.peakBytes = bytes;
      } finally {
        this.sampling = false;
      }
    }, MEMORY_SAMPLE_INTERVAL_MS);
  }

  async stop(): Promise<number> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const finalBytes = await sampleHeapBytes();
    if (finalBytes > this.peakBytes) this.peakBytes = finalBytes;
    return this.peakBytes;
  }
}

function createComparisonWorker(): {
  worker: Worker;
  api: Comlink.Remote<ComparisonWorkerApi>;
} {
  const worker = new Worker(new URL("../../lib/ml/comparisonWorker.ts", import.meta.url), {
    type: "module",
  });
  return { worker, api: Comlink.wrap<ComparisonWorkerApi>(worker) };
}

function withAbort<T>(
  worker: Worker,
  signal: AbortSignal | undefined,
  promise: Promise<T>,
): Promise<T> {
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener(
      "abort",
      () => {
        worker.terminate();
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
  return Promise.race([promise, abortPromise]);
}

export async function runColdStart(
  kind: ModelKind,
  signal?: AbortSignal,
  onDownloadProgress?: (loaded: number, total: number) => void,
): Promise<{ coldStartMs: number; coldPeakJSHeapMB: number }> {
  const { worker, api } = createComparisonWorker();
  const sampler = new HeapSampler();
  try {
    await sampler.start();
    const { coldStartMs } = await withAbort(
      worker,
      signal,
      api.loadModel(kind, onDownloadProgress ? Comlink.proxy(onDownloadProgress) : undefined, true),
    );
    const peakJSHeapBytes = await sampler.stop();
    return { coldStartMs, coldPeakJSHeapMB: peakJSHeapBytes / 1024 / 1024 };
  } finally {
    await sampler.stop();
    if (!signal?.aborted) await api.disposeModel();
    worker.terminate();
  }
}

export async function runRest(
  kind: ModelKind,
  texts: string[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<RestMetrics> {
  const { worker, api } = createComparisonWorker();
  const sampler = new HeapSampler();

  try {
    onProgress?.("Loading model…", 0, 0);
    const tWarm = performance.now();
    await withAbort(worker, signal, api.loadModel(kind));
    const warmStartMs = performance.now() - tWarm;

    onProgress?.("Warming up…", 0, 0);
    await sampler.start();
    const { latencies } = await withAbort(
      worker,
      signal,
      api.runComparison(
        texts,
        Comlink.proxy((current: number, total: number) =>
          onProgress?.("Running inference…", current, total),
        ),
      ),
    );
    const peakJSHeapBytes = await sampler.stop();

    return {
      warmStartMs,
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      peakJSHeapMB: peakJSHeapBytes / 1024 / 1024,
    };
  } finally {
    await sampler.stop();
    if (!signal?.aborted) await api.disposeModel();
    worker.terminate();
  }
}

export const IDLE_PROGRESS: ComparisonProgress = {
  stage: "",
  current: 0,
  total: 0,
};
