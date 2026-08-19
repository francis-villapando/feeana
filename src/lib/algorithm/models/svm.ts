import type { Tensor } from "onnxruntime-web";
import { Preprocess } from "../preprocess";
import type { ModelAdapter, Prediction } from "./types";

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
  const res = await fetch(`${dir}/label_mappings.json`);
  if (!res.ok) {
    throw new Error(`Failed to load SVM label mappings (HTTP ${res.status})`);
  }
  return (await res.json()) as SvmLabelMappings;
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

  async load(): Promise<void> {
    const runtime = await initOrt();
    const dir = getSvmModelDir();
    this.session = await runtime.InferenceSession.create(`${dir}/svm.onnx`);
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
