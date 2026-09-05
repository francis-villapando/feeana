import * as Comlink from "comlink";
import Papa from "papaparse";
import type { ModelKind } from "@/lib/algorithm/models";
import type { ComparisonWorkerApi } from "@/lib/ml/comparisonWorker";
import {
  MODEL_CACHE_KEYS as CACHE_KEYS_MAP,
  LEGACY_CACHE_KEYS,
} from "../../lib/algorithm/models/modelCache";

export const MODEL_KINDS = ["distilxlmr", "mbert", "svm"] as const;

// Canonical (descriptive) cache names, plus the legacy names they replaced so a
// full cache wipe also removes stale entries from earlier releases.
export const MODEL_CACHE_KEYS = [...Object.values(CACHE_KEYS_MAP), ...LEGACY_CACHE_KEYS];

export const STORAGE_KEY = "feeana-comparison-progress-v1";
// Increment to invalidate persisted results when the stored metric shape changes.
export const STORAGE_VERSION = 5;

export const RESULT_KEYS = [
  "coldStartMs",
  "coldPeakJSHeapMB",
  "warmStartMs",
  "avgLatencyMs",
  "p50LatencyMs",
  "p95LatencyMs",
  "peakJSHeapMB",
  "coldTTFRMs",
  "warmTTFRMs",
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
    // Ignore quota/private-mode failures.
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
  const res = await fetch("/model-data/sop5-2-benchmark-sample.csv");
  if (!res.ok) throw new Error("Failed to load benchmark sample");
  const csv = await res.text();
  const parsed = Papa.parse<TestSetRow>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`Failed to parse benchmark sample: ${parsed.errors[0].message}`);
  }
  return parsed.data.map((row) => ({
    id: String(row.id),
    text: row.text,
    expectedIssue: row.issue,
  }));
}

export async function clearModelCaches(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  const cleared: string[] = [];
  for (const key of MODEL_CACHE_KEYS) {
    try {
      if (await caches.delete(key)) cleared.push(key);
    } catch {
      // Ignore.
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
  /** End-to-end time from trigger click to first result (cold: no cache). */
  coldTTFRMs: number;
  /** End-to-end time from trigger click to first result (warm: cached). */
  warmTTFRMs: number;
  /** Set when this model failed to complete; other metrics are absent. */
  error?: string;
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
  onDownloadProgress?: (loaded: number, total: number, phase?: string) => void,
): Promise<{ coldStartMs: number; coldPeakJSHeapMB: number }> {
  const { worker, api } = createComparisonWorker();
  try {
    const { coldStartMs, peakWorkerHeapMB } = await withAbort(
      worker,
      signal,
      api.loadModel(
        kind,
        onDownloadProgress ? Comlink.proxy(onDownloadProgress) : undefined,
        true,
        true,
      ),
    );
    return { coldStartMs, coldPeakJSHeapMB: peakWorkerHeapMB };
  } finally {
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

  try {
    onProgress?.("Loading model…", 0, 0);
    const tWarm = performance.now();
    // Warm start: load from cache without warmup inference (warmup runs in the
    // dedicated warmup phase of runComparison below).
    await withAbort(worker, signal, api.loadModel(kind, undefined, false, true));
    const warmStartMs = performance.now() - tWarm;

    onProgress?.("Warming up…", 0, 0);
    const { latencies, peakWorkerHeapMB } = await withAbort(
      worker,
      signal,
      api.runComparison(
        texts,
        Comlink.proxy((current: number, total: number) =>
          onProgress?.("Running inference…", current, total),
        ),
      ),
    );

    return {
      warmStartMs,
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      peakJSHeapMB: peakWorkerHeapMB,
    };
  } finally {
    if (!signal?.aborted) await api.disposeModel();
    worker.terminate();
  }
}

async function runTimeToFirstResult(
  kind: ModelKind,
  firstText: string,
  cold: boolean,
  signal?: AbortSignal,
): Promise<number> {
  const { worker, api } = createComparisonWorker();
  try {
    const fn = cold ? api.coldTimeToFirstResult : api.warmTimeToFirstResult;
    const { endToEndMs } = await withAbort(worker, signal, fn(kind, firstText));
    return endToEndMs;
  } finally {
    if (!signal?.aborted) await api.disposeModel();
    worker.terminate();
  }
}

export async function runColdTTFR(
  kind: ModelKind,
  firstText: string,
  signal?: AbortSignal,
): Promise<number> {
  return runTimeToFirstResult(kind, firstText, true, signal);
}

export async function runWarmTTFR(
  kind: ModelKind,
  firstText: string,
  signal?: AbortSignal,
): Promise<number> {
  return runTimeToFirstResult(kind, firstText, false, signal);
}

export const IDLE_PROGRESS: ComparisonProgress = {
  stage: "",
  current: 0,
  total: 0,
};
