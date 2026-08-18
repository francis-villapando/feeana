import * as Comlink from "comlink";
import {
  createModel,
  type ModelAdapter,
  type ModelKind,
  type Prediction,
} from "../algorithm/models";

const WARMUP_COUNT = 3;

let model: ModelAdapter | null = null;

async function loadModel(kind: ModelKind): Promise<{ coldStartMs: number }> {
  if (model) await disposeModel();
  const t0 = performance.now();
  model = createModel(kind);
  await model.load();
  return { coldStartMs: performance.now() - t0 };
}

async function runBenchmark(
  texts: string[],
  onProgress?: (current: number, total: number) => void,
): Promise<{
  predictions: Prediction[];
  latencies: number[];
}> {
  if (!model) {
    throw new Error("[benchmarkWorker] No model loaded — call loadModel() first.");
  }

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

  return { predictions, latencies };
}

async function disposeModel(): Promise<void> {
  await model?.dispose();
  model = null;
}

const api = { loadModel, runBenchmark, disposeModel };

export type BenchmarkWorkerApi = typeof api;

Comlink.expose(api);
