import type { Tensor } from "onnxruntime-web";
import { Preprocess } from "../preprocess";
import type { ModelLoadProgress, ModelAdapter, Prediction } from "./types";
import { MODEL_SIZES_BYTES } from "./sizes";
import { cachedFetch, cachePut } from "./modelCache";

const SVM_CACHE_KEY = "feeana-model-cache-svm-v1";
const SVM_KNOWN_MODEL_SIZE = MODEL_SIZES_BYTES.svm;

function isNode(): boolean {
  return typeof process !== "undefined" && process.versions?.node !== undefined;
}

interface OrtSession {
  run(feeds: Record<string, Tensor>): Promise<Record<string, { data: unknown }>>;
  release(): Promise<void>;
}

interface OrtRuntime {
  env: { wasm: { wasmPaths?: string | { wasm?: string | URL; mjs?: string | URL } } };
  InferenceSession: {
    create(source: string | Uint8Array): Promise<OrtSession>;
  };
  Tensor: new (
    type: string,
    data: ArrayLike<number | bigint> | string[],
    dims?: number[],
  ) => Tensor;
}

interface SvmLabelMappings {
  issue: { id2label: Record<string, string> };
  polarity: { id2label: Record<string, string> };
}

let ort: OrtRuntime | null = null;

async function initOrt(): Promise<OrtRuntime> {
  if (ort) return ort;

  if (isNode()) {
    try {
      ort = await import(/* @vite-ignore */ "onnxruntime-node");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Failed to load onnxruntime-node:", message);
      console.log("Please run 'npm install onnxruntime-node'");
      throw e;
    }
  } else {
    ort = await import("onnxruntime-web");
    ort.env.wasm.wasmPaths = "/onnxruntime/";
  }
  return ort;
}

function getSvmModelDir(): string {
  if (isNode()) {
    return `${process.cwd()}/public/models/trained/svm`;
  }
  return "/models/trained/svm";
}

async function loadLabelMappings(dir: string): Promise<SvmLabelMappings> {
  if (isNode()) {
    const fs = await import("fs");
    const raw = fs.readFileSync(`${dir}/label_mappings.json`, "utf-8");
    return JSON.parse(raw) as SvmLabelMappings;
  }
  const url = `${dir}/label_mappings.json`;
  const cached = await cachedFetch(url, SVM_CACHE_KEY);
  const res = cached ?? (await fetch(url));
  if (!res.ok) {
    throw new Error(`Failed to load SVM label mappings (HTTP ${res.status})`);
  }
  const body = await res.arrayBuffer();
  if (!cached) await cachePut(url, body, SVM_CACHE_KEY);
  return JSON.parse(new TextDecoder().decode(body)) as SvmLabelMappings;
}

function softmax(values: Float32Array): number[] {
  const exp = Array.from(values).map((v) => Math.exp(v));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((v) => v / sum);
}

export class SvmAdapter implements ModelAdapter {
  readonly name = "svm";
  private session: OrtSession | null = null;
  private labelMap: SvmLabelMappings | null = null;
  private progressHook?: (info: ModelLoadProgress) => void;
  private coldMode = false;

  setProgressHook(hook: (info: ModelLoadProgress) => void): void {
    this.progressHook = hook;
  }

  setColdMode(enabled: boolean): void {
    this.coldMode = enabled;
  }

  private async readModelWithProgress(url: string): Promise<Uint8Array> {
    if (isNode()) {
      const { readFileSync } = await import("fs");
      return Promise.resolve(readFileSync(url));
    }

    // Serve from Cache Storage (unless measuring a true cold start)
    if (!this.coldMode) {
      const cached = await cachedFetch(url, SVM_CACHE_KEY);
      if (cached) {
        this.progressHook?.({
          status: "progress",
          progress: 60,
          phase: "download",
          source: "cache",
        });
        return new Uint8Array(await cached.arrayBuffer());
      }
    }

    return fetch(url, this.coldMode ? { cache: "no-store" } : undefined).then(async (response) => {
      if (!response.ok) throw new Error(`Failed to load SVM model (HTTP ${response.status})`);
      const total = Number(response.headers.get("content-length") ?? 0) || SVM_KNOWN_MODEL_SIZE;
      if (!response.body) {
        this.progressHook?.({ status: "loading", progress: 0, source: "network" });
        const buf = new Uint8Array(await response.arrayBuffer());
        await cachePut(url, buf, SVM_CACHE_KEY);
        return buf;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      return new Promise<Uint8Array>((resolve) => {
        const readChunk = () => {
          reader.read().then(async ({ done, value }) => {
            if (done) {
              const buffer = new Uint8Array(loaded);
              let offset = 0;
              for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.length;
              }
              await cachePut(url, buffer, SVM_CACHE_KEY);
              resolve(buffer);
              return;
            }
            chunks.push(value);
            loaded += value.length;
            this.progressHook?.({
              status: "progress",
              progress: Math.min(60, (loaded / total) * 60),
              phase: "download",
              source: "network",
              bytes: { loaded, total },
            });
            readChunk();
          });
        };
        readChunk();
      });
    });
  }

  // Pre-cache ORT WASM binaries in the background
  private async warmAuxCache(): Promise<void> {
    if (isNode()) return;
    const wasmUrls = [
      "/onnxruntime/ort-wasm-simd-threaded.wasm",
      "/onnxruntime/ort-wasm-simd-threaded.jsep.wasm",
    ];
    for (const url of wasmUrls) {
      try {
        if (await cachedFetch(url, SVM_CACHE_KEY)) continue;
        const res = await fetch(url);
        if (res.ok) await cachePut(url, await res.arrayBuffer(), SVM_CACHE_KEY);
      } catch {
        // ignore
      }
    }
  }

  async load(): Promise<void> {
    const runtime = await initOrt();
    const dir = getSvmModelDir();
    const url = `${dir}/svm.onnx`;

    const modelBuffer = await this.readModelWithProgress(url);

    this.session = await runtime.InferenceSession.create(modelBuffer);
    this.labelMap = await loadLabelMappings(dir);

    // JIT warmup: compile WASM kernels ahead of workload
    try {
      const feeds: Record<string, Tensor> = {
        string_input: new runtime.Tensor("string", ["warmup"], [1, 1]),
      };
      await this.session.run(feeds);
    } catch (e) {
      console.warn("[svm] Warmup inference failed (non-fatal):", e);
    }

    void this.warmAuxCache();
  }

  async predict(text: string): Promise<Prediction> {
    const t0 = performance.now();
    if (!this.session || !this.labelMap) {
      throw new Error("[svm] Adapter not loaded — call load() first.");
    }

    const runtime = await initOrt();
    const cleanText = Preprocess({ id: "", rawText: text });
    const feeds: Record<string, Tensor> = {
      string_input: new runtime.Tensor("string", [cleanText], [1, 1]),
    };

    const result = await this.session.run(feeds);

    const issueIdx = Number((result["issue_label"].data as ArrayLike<number | bigint>)[0]);
    const polarityIdx = Number((result["polarity_label"].data as ArrayLike<number | bigint>)[0]);

    const issue = this.labelMap.issue.id2label[String(issueIdx)] ?? "uncategorized";
    const polarity = (this.labelMap.polarity.id2label[String(polarityIdx)] ??
      "neu") as Prediction["polarity"];
    const probs = result["issue_probabilities"].data as Float32Array;

    return {
      issue,
      polarity,
      confidence: Math.max(...softmax(probs)),
      latencyMs: performance.now() - t0,
    };
  }

  async dispose(): Promise<void> {
    await this.session?.release();
    this.session = null;
  }
}
