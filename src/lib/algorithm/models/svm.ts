import type { Tensor } from "onnxruntime-web";
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

export class SvmAdapter implements ModelAdapter {
  readonly name = "svm";
  private session: OrtSession | null = null;

  async load(): Promise<void> {
    const runtime = await initOrt();
    const modelPath = getModelPath();
    this.session = await runtime.InferenceSession.create(modelPath);
  }

  async predict(text: string): Promise<Prediction> {
    const t0 = performance.now();
    const runtime = await initOrt();
    const feeds: Record<string, Tensor> = {
      string_input: new runtime.Tensor("string", [text], [1, 1]),
    };
    const results = await this.session!.run(feeds);
    const probs = results["probabilities"].data as Float32Array;
    const label = results["output_label"].data as string[];
    return {
      issue: label[0],
      polarity: "neg",
      confidence: Math.max(...probs),
      latencyMs: performance.now() - t0,
    };
  }

  async dispose(): Promise<void> {
    await this.session?.release();
    this.session = null;
  }
}

function getModelPath(): string {
  if (!isNode()) {
    return "/models/svm-pipeline.onnx";
  }
  return `${process.cwd()}/public/models/svm-pipeline.onnx`;
}
