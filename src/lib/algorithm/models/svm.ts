import type { InferenceSession, Tensor } from "onnxruntime-web";
import type { ModelAdapter, Prediction } from "./types";

function isNode(): boolean {
  return typeof process !== "undefined" && process.versions?.node !== undefined;
}

let ort: any = null;

async function initOrt() {
  if (ort) return ort;
  
  if (isNode()) {
    try {
      ort = await import(/* @vite-ignore */ "onnxruntime-node");
    } catch (e: any) {
      console.error("Failed to load onnxruntime-node:", e.message);
      console.log("Please run 'npm install onnxruntime-node'");
      throw e;
    }
  } else {
    ort = await import("onnxruntime-web");
  }
  return ort;
}

export class SvmAdapter implements ModelAdapter {
  readonly name = "svm";
  private session: InferenceSession | null = null;

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