import type { InferenceSession, Tensor } from "onnxruntime-web";
import { AutoTokenizer, env } from "@huggingface/transformers";
import { Preprocess } from "../preprocess";
import type { ModelAdapter, Prediction } from "./types";

const MAX_LEN = 256;
const INT8_MODEL = "distilxlmr-pidabsa-int8.onnx";

function isNode(): boolean {
  return typeof process !== "undefined" && process.versions?.node !== undefined;
}

function getModelDir(): string {
  if (isNode()) {
    return `${process.cwd()}/public/models/finetuned`;
  }
  return "/models/finetuned";
}

let ort: any = null;

async function initOrt() {
  if (ort) return ort;

  try {
    ort = await import("onnxruntime-web");
    ort.env.wasm.wasmPaths = "/onnxruntime/";
  } catch (e: any) {
    console.error("Failed to load onnxruntime-web:", e.message);
    throw e;
  }
  return ort;
}

interface LabelMappings {
  issue: { id2label: Record<string, string> };
  polarity: { id2label: Record<string, string> };
}

async function loadLabelMappings(dir: string): Promise<LabelMappings> {
  if (isNode()) {
    const fs = await import("fs");
    const file = `${dir}/label_mappings.json`;
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as LabelMappings;
  }
  const res = await fetch(`${dir}/label_mappings.json`);
  if (!res.ok) {
    throw new Error(`Failed to load label mappings (HTTP ${res.status})`);
  }
  return (await res.json()) as LabelMappings;
}

function softmax(logits: Float32Array): number[] {
  const exp = Array.from(logits).map((v) => Math.exp(v));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((v) => v / sum);
}

function argmax(probs: number[]): number {
  return probs.indexOf(Math.max(...probs));
}

export class DistilXlmrAdapter implements ModelAdapter {
  readonly name = "distilxlmr";
  session: InferenceSession | null = null;
  tokenizer: any = null;
  labelMap: LabelMappings | null = null;
  progressHook?: (info: any) => void;

  private async readModelWithProgress(url: string): Promise<Uint8Array> {
    if (isNode()) {
      const { readFileSync } = await import("fs");
      return Promise.resolve(readFileSync(url));
    }
    return fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Failed to load model (HTTP ${response.status})`);
      const total = Number(response.headers.get("content-length") ?? 0);
      if (!response.body || total === 0) {
        this.progressHook?.({ status: "loading", progress: 0 });
        return response.arrayBuffer().then((buf) => new Uint8Array(buf));
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      return new Promise<Uint8Array>((resolve) => {
        const readChunk = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              const buffer = new Uint8Array(loaded);
              let offset = 0;
              for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.length;
              }
              resolve(buffer);
              return;
            }
            chunks.push(value);
            loaded += value.length;
            this.progressHook?.({
              status: "progress",
              progress: Math.min(60, (loaded / total) * 100),
            });
            readChunk();
          });
        };
        readChunk();
      });
    });
  }

  async load(): Promise<void> {
    const runtime = await initOrt();
    const dir = getModelDir();

    env.allowLocalModels = true;

    // Phase 1: Model download (0-60%)
    const modelBuffer = await this.readModelWithProgress(`${dir}/${INT8_MODEL}`);
    
    // Phase 2: Session creation (60-70%)
    this.progressHook?.({ status: "progress", progress: 60, phase: "session" });
    this.session = await runtime.InferenceSession.create(modelBuffer);
    
    // Phase 3: Tokenizer loading (70-95%) - this is the heaviest step
    this.progressHook?.({ status: "progress", progress: 70, phase: "tokenizer" });
    this.tokenizer = await AutoTokenizer.from_pretrained(dir, { local_files_only: true });
    this.progressHook?.({ status: "progress", progress: 95, phase: "tokenizer" });
    
    // Phase 4: Label mappings (95-99%)
    this.progressHook?.({ status: "progress", progress: 95, phase: "labels" });
    this.labelMap = await loadLabelMappings(dir);
    this.progressHook?.({ status: "progress", progress: 99, phase: "labels" });

    console.log("[distilXlmr] Loaded fine-tuned DistilXLM-R model");

    this.progressHook?.({ status: "done", progress: 100 });
  }

  async predict(text: string): Promise<Prediction> {
    const t0 = performance.now();
    const cleanText = Preprocess({ id: "", rawText: text });
    const result = await this.runCleaned(cleanText);
    return { ...result, latencyMs: performance.now() - t0 };
  }

  async predictCleaned(cleanText: string): Promise<Prediction> {
    const t0 = performance.now();
    const result = await this.runCleaned(cleanText);
    return { ...result, latencyMs: performance.now() - t0 };
  }

  private async runCleaned(cleanText: string): Promise<Prediction> {
    if (!this.session || !this.tokenizer || !this.labelMap) {
      throw new Error("[distilXlmr] Adapter not loaded — call load() first.");
    }

    const encoding = this.tokenizer(cleanText, {
      padding: "max_length",
      truncation: true,
      max_length: MAX_LEN,
      return_tensor: true,
    });

    const runtime = await initOrt();
    const feeds: Record<string, Tensor> = {
      input_ids: new runtime.Tensor("int64", BigInt64Array.from(encoding.input_ids.data), [
        1,
        MAX_LEN,
      ]),
      attention_mask: new runtime.Tensor(
        "int64",
        BigInt64Array.from(encoding.attention_mask.data),
        [1, MAX_LEN],
      ),
    };

    const results = await this.session.run(feeds);

    const issueProbs = softmax(results["issue_logits"].data as Float32Array);
    const polarityProbs = softmax(results["polarity_logits"].data as Float32Array);

    const issueIdx = argmax(issueProbs);
    const polarityIdx = argmax(polarityProbs);

    let issue = this.labelMap.issue.id2label[String(issueIdx)] ?? "Uncategorized";
    if (issue === "uncategorized") {
      issue = "Uncategorized";
    }
    const polarity = (this.labelMap.polarity.id2label[String(polarityIdx)] ??
      "neu") as Prediction["polarity"];

    return {
      issue,
      polarity,
      confidence: issueProbs[issueIdx],
      latencyMs: 0,
    };
  }

  async dispose(): Promise<void> {
    await this.session?.release();
    this.session = null;
  }
}
