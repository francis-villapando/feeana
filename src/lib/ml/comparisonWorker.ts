import * as Comlink from "comlink";
import {
  createModel,
  type ModelAdapter,
  type ModelKind,
  type Prediction,
} from "../algorithm/models";

const WARMUP_COUNT = 3;

let model: ModelAdapter | null = null;

// Worker-side heap sampling. Reports the V8 JS heap of this worker (including
// JS wrappers and buffers), which is where ONNX models execute. It cannot
// introspect private WebAssembly.Memory pages directly, so metrics represent
// worker heap utilization.
interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number };
}

function sampleWorkerHeapBytes(): number {
  try {
    return (performance as PerformanceWithMemory).memory?.usedJSHeapSize ?? 0;
  } catch {
    return 0;
  }
}

async function sampleWorkerHeapPeak(): Promise<number> {
  let peak = sampleWorkerHeapBytes();
  // Fine granularity to catch transient peaks on fast models.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 10));
    const bytes = sampleWorkerHeapBytes();
    if (bytes > peak) peak = bytes;
  }
  return peak;
}

async function loadModel(
  kind: ModelKind,
  onDownloadProgress?: (loaded: number, total: number, phase?: string) => void,
  coldMode = false,
  skipWarmup = false,
): Promise<{ coldStartMs: number; peakWorkerHeapMB: number }> {
  if (model) await disposeModel();
  const t0 = performance.now();
  const adapter = createModel(kind);
  adapter.setProgressHook?.((info) => {
    if (info.bytes && info.source === "network") {
      onDownloadProgress?.(info.bytes.loaded, info.bytes.total, info.phase);
    } else if (info.phase) {
      onDownloadProgress?.(0, 0, info.phase);
    }
  });
  adapter.setColdMode?.(coldMode);
  model = adapter;
  await model.load({ skipWarmup });
  const peakWorkerHeapMB = (await sampleWorkerHeapPeak()) / 1024 / 1024;
  return { coldStartMs: performance.now() - t0, peakWorkerHeapMB };
}

async function runComparison(
  texts: string[],
  onProgress?: (current: number, total: number) => void,
): Promise<{
  predictions: Prediction[];
  latencies: number[];
  peakWorkerHeapMB: number;
}> {
  if (!model) {
    throw new Error("[comparisonWorker] No model loaded — call loadModel() first.");
  }

  // Dedicated warmup phase: run JIT warmup before timing benchmark samples so
  // warmup compute is excluded from latency metrics.
  for (let i = 0; i < Math.min(WARMUP_COUNT, texts.length); i++) {
    await model.predict(texts[i]);
  }

  const predictions: Prediction[] = [];
  const latencies: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    onProgress?.(i + 1, texts.length);
    const t0 = performance.now();
    predictions.push(await model.predict(texts[i]));
    latencies.push(performance.now() - t0);
  }

  const peakWorkerHeapMB = (await sampleWorkerHeapPeak()) / 1024 / 1024;
  return { predictions, latencies, peakWorkerHeapMB };
}

async function disposeModel(): Promise<void> {
  await model?.dispose();
  model = null;
}

// End-to-end time-to-first-result: load + JIT warmup + first inference on the
// user's text. Kept separate from per-sample inference latency.
async function timeToFirstResult(
  kind: ModelKind,
  firstText: string,
  coldMode: boolean,
): Promise<{ endToEndMs: number }> {
  if (model) await disposeModel();
  const t0 = performance.now();
  const adapter = createModel(kind);
  adapter.setColdMode?.(coldMode);
  model = adapter;
  // skipWarmup keeps load() measuring pure load; warmup runs explicitly below.
  await model.load({ skipWarmup: true });
  for (let i = 0; i < WARMUP_COUNT; i++) {
    await model.predict(firstText);
  }
  await model.predict(firstText);
  return { endToEndMs: performance.now() - t0 };
}

async function coldTimeToFirstResult(
  kind: ModelKind,
  firstText: string,
): Promise<{ endToEndMs: number }> {
  return timeToFirstResult(kind, firstText, true);
}

async function warmTimeToFirstResult(
  kind: ModelKind,
  firstText: string,
): Promise<{ endToEndMs: number }> {
  return timeToFirstResult(kind, firstText, false);
}

const api = {
  loadModel,
  runComparison,
  disposeModel,
  coldTimeToFirstResult,
  warmTimeToFirstResult,
};

export type ComparisonWorkerApi = typeof api;

Comlink.expose(api);
