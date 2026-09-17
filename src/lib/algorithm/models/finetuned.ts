import type { InferenceSession, Tensor } from "onnxruntime-web";
import { AutoTokenizer, env } from "@huggingface/transformers";
import { CleanFeedback, EncodeFeedback, MAX_SEQ_LEN, type MachineTokenizer } from "../preprocess";
import type { FeedbackEncoding } from "../types";
import { buildModelInternals, type HeadWeightMatrices, type ModelInternals } from "../internals";
import type { ModelLoadProgress, ModelAdapter, ModelLoadOptions, Prediction } from "./types";
import { MODEL_SIZES_BYTES } from "./sizes";
import { cachedFetch, cachePut, MODEL_CACHE_KEYS } from "./modelCache";

export type { ModelLoadProgress as LoadProgress } from "./types";
export type { ModelInternals } from "../internals";

// Requested explicitly on every fast-path run so the large internal tensors
// (attention, hidden states) are never materialised for batch inference.
const LOGIT_OUTPUTS: readonly string[] = ["issue_logits", "polarity_logits"];

// Full graph outputs used by the Algorithm Simulation workbench.
const FULL_OUTPUTS: readonly string[] = [
  "issue_logits",
  "polarity_logits",
  "pooled_output",
  "attentions",
  "hidden_states",
];

export interface FinetunedModelConfig {
  name: string;
  modelDir: string;
  hfRepo: string;
  onnxFile?: string;
  cacheKey?: string;
  knownModelSize?: number;
}

function isNode(): boolean {
  return typeof process !== "undefined" && process.versions?.node !== undefined;
}

// Namespace the shared transformers.js cache (tokenizer, etc.).
if (!isNode()) {
  env.cacheKey = MODEL_CACHE_KEYS.hf;
}

function getHfFileUrl(hfRepo: string, file: string): string {
  return `https://huggingface.co/${hfRepo}/resolve/main/${file}`;
}

function getBaseModelDir(): string {
  if (isNode()) {
    return `${process.cwd()}/public/models/finetuned`;
  }
  return "/models/finetuned";
}

let ort: typeof import("onnxruntime-web") | null = null;

async function initOrt(): Promise<typeof import("onnxruntime-web")> {
  if (ort) return ort;

  try {
    ort = await import("onnxruntime-web");
    if (!isNode()) {
      ort.env.wasm.wasmPaths = "/onnxruntime/";
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Failed to load onnxruntime-web:", message);
    throw e;
  }
  return ort;
}

// Persistent offline cache (Cache Storage API).

interface LabelMappings {
  issue: { id2label: Record<string, string> };
  polarity: { id2label: Record<string, string> };
}

async function loadLabelMappings(
  localDir: string,
  remoteUrl: string,
  cacheKey: string,
): Promise<LabelMappings> {
  if (isNode()) {
    const fs = await import("fs");
    const file = `${localDir}/label_mappings.json`;
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as LabelMappings;
  }
  const cached = await cachedFetch(remoteUrl, cacheKey);
  const res = cached ?? (await fetch(remoteUrl));
  if (!res.ok) {
    throw new Error(`Failed to load label mappings (HTTP ${res.status})`);
  }
  const body = await res.arrayBuffer();
  if (!cached) await cachePut(remoteUrl, body, cacheKey);
  return JSON.parse(new TextDecoder().decode(body)) as LabelMappings;
}

// Head matrices ship as a JSON sidecar (the ONNX quantizer renames/rewrites
// parameter-derived graph outputs). Optional: the logit decomposition degrades
// gracefully when it is missing.
interface RawHeadWeightsJson {
  hidden_size?: number;
  issue_weights?: number[][];
  issue_bias?: number[];
  polarity_weights?: number[][];
  polarity_bias?: number[];
}

// The sidecar serializes the two heads flat; reshape into the head-keyed form
// the internals module consumes.
function parseHeadWeights(text: string): HeadWeightMatrices | null {
  const json = JSON.parse(text) as RawHeadWeightsJson;
  const { issue_weights, issue_bias, polarity_weights, polarity_bias } = json;
  if (!issue_weights || !issue_bias || !polarity_weights || !polarity_bias) {
    console.warn("[finetuned] head_weights.json is missing required matrices");
    return null;
  }
  return {
    issue: { weights: issue_weights, bias: issue_bias },
    polarity: { weights: polarity_weights, bias: polarity_bias },
  };
}

async function loadHeadWeights(
  localDir: string,
  remoteUrl: string,
  cacheKey: string,
): Promise<HeadWeightMatrices | null> {
  try {
    if (isNode()) {
      const fs = await import("fs");
      return parseHeadWeights(fs.readFileSync(`${localDir}/head_weights.json`, "utf-8"));
    }
    const cached = await cachedFetch(remoteUrl, cacheKey);
    const res = cached ?? (await fetch(remoteUrl));
    if (!res.ok) return null;
    const body = await res.arrayBuffer();
    if (!cached) await cachePut(remoteUrl, body, cacheKey);
    return parseHeadWeights(new TextDecoder().decode(body));
  } catch (e) {
    console.warn(`[finetuned] Head weights unavailable (${remoteUrl}):`, e);
    return null;
  }
}

function softmax(logits: Float32Array): number[] {
  const exp = Array.from(logits).map((v) => Math.exp(v));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((v) => v / sum);
}

function argmax(probs: number[]): number {
  return probs.indexOf(Math.max(...probs));
}

// Module 3: low-confidence top-1 predictions route to "Uncategorized"
// so false positives don't distort diagnostic cues.
export const CONFIDENCE_FALLBACK_THRESHOLD = 0.31;

export function applyConfidenceFallback(
  rawIssue: string,
  topConfidence: number,
  threshold: number = CONFIDENCE_FALLBACK_THRESHOLD,
): string {
  return topConfidence < threshold ? "Uncategorized" : rawIssue;
}

export class OnnxPidAbsaAdapter implements ModelAdapter {
  readonly name: string;
  session: InferenceSession | null = null;
  tokenizer: MachineTokenizer | null = null;
  labelMap: LabelMappings | null = null;
  headWeights: HeadWeightMatrices | null = null;
  progressHook?: (info: ModelLoadProgress) => void;
  private coldMode = false;

  setProgressHook(hook: (info: ModelLoadProgress) => void): void {
    this.progressHook = hook;
  }

  setColdMode(enabled: boolean): void {
    this.coldMode = enabled;
  }

  protected readonly config: Required<FinetunedModelConfig>;

  constructor(config: FinetunedModelConfig) {
    this.name = config.name;
    this.config = {
      onnxFile: "int8.onnx",
      cacheKey: MODEL_CACHE_KEYS.distilxlmr,
      knownModelSize: MODEL_SIZES_BYTES.distilxlmr,
      ...config,
    };
  }

  protected get modelDir(): string {
    return `${getBaseModelDir()}/${this.config.modelDir}`;
  }

  protected get onnxUrl(): string {
    if (isNode()) return `${this.modelDir}/${this.config.onnxFile}`;
    return getHfFileUrl(this.config.hfRepo, this.config.onnxFile);
  }

  private async readModelWithProgress(url: string): Promise<Uint8Array> {
    if (isNode()) {
      const { readFileSync } = await import("fs");
      return Promise.resolve(readFileSync(url));
    }

    // Serve from Cache Storage (unless measuring a true cold start).
    if (!this.coldMode) {
      const cached = await cachedFetch(url, this.config.cacheKey);
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
      if (!response.ok) throw new Error(`Failed to load model (HTTP ${response.status})`);
      const total =
        Number(response.headers.get("content-length") ?? 0) || this.config.knownModelSize;
      if (!response.body) {
        this.progressHook?.({ status: "loading", progress: 0, source: "network" });
        const buf = new Uint8Array(await response.arrayBuffer());
        await cachePut(url, buf, this.config.cacheKey);
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
              await cachePut(url, buffer, this.config.cacheKey);
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

  // Pre-cache ORT WASM binaries in the background.
  private async warmAuxCache(): Promise<void> {
    if (isNode()) return;
    const wasmUrls = [
      "/onnxruntime/ort-wasm-simd-threaded.wasm",
      "/onnxruntime/ort-wasm-simd-threaded.jsep.wasm",
    ];
    for (const url of wasmUrls) {
      try {
        if (await cachedFetch(url, this.config.cacheKey)) continue;
        const res = await fetch(url);
        if (res.ok) await cachePut(url, await res.arrayBuffer(), this.config.cacheKey);
      } catch {
        // Ignore
      }
    }
  }

  async load(options?: ModelLoadOptions): Promise<void> {
    const runtime = await initOrt();
    const dir = this.modelDir;

    env.allowLocalModels = isNode();

    // Phase 1: Model download / cache-read (0-60%)
    const modelBuffer = await this.readModelWithProgress(this.onnxUrl);

    // Phase 2: Session creation (60-70%) — WASM execution provider
    this.progressHook?.({ status: "progress", progress: 60, phase: "session" });
    this.session = await runtime.InferenceSession.create(modelBuffer, {
      executionProviders: ["wasm"],
    });

    // Phase 3: Tokenizer loading (70-95%)
    this.progressHook?.({ status: "progress", progress: 70, phase: "tokenizer" });
    // Controlled cast: HF's generic Tensor typing does not match MachineTokenizer.
    this.tokenizer = (isNode()
      ? await AutoTokenizer.from_pretrained(dir, {
          local_files_only: true,
        })
      : await AutoTokenizer.from_pretrained(this.config.hfRepo)) as unknown as MachineTokenizer;
    this.progressHook?.({ status: "progress", progress: 95, phase: "tokenizer" });

    // Phase 4: Label mappings (95-99%)
    this.progressHook?.({ status: "progress", progress: 95, phase: "labels" });
    this.labelMap = await loadLabelMappings(
      dir,
      getHfFileUrl(this.config.hfRepo, "label_mappings.json"),
      this.config.cacheKey,
    );
    this.progressHook?.({ status: "progress", progress: 99, phase: "labels" });

    // JIT warmup: compile WASM kernels ahead of workload. Skipped when the
    // caller measures pure load timing (e.g. benchmarks).
    if (!options?.skipWarmup) {
      try {
        await this.predict("warmup");
      } catch (e) {
        console.warn(`[${this.name}] Warmup inference failed (non-fatal):`, e);
      }
    }

    void this.warmAuxCache();

    console.log(`[${this.name}] Loaded fine-tuned model (${this.config.modelDir})`);

    this.progressHook?.({ status: "done", progress: 100 });
  }

  // High-level prediction contract: cleans, encodes, and runs inference.
  async predict(text: string): Promise<Prediction> {
    if (!this.tokenizer) {
      throw new Error(`[${this.name}] Tokenizer not loaded — call load() first.`);
    }
    const t0 = performance.now();
    const encoding = EncodeFeedback(CleanFeedback(text), this.tokenizer);
    const result = await this.predictEncoded(encoding);
    return { ...result, latencyMs: performance.now() - t0 };
  }

  // Exposes the subword token strings for a cleaned text. The stored tokenizer
  // is the full HF AutoTokenizer instance (MachineTokenizer is only a structural
  // subset), so tokenize() is available at runtime.
  tokenize(text: string): string[] {
    if (!this.tokenizer) {
      throw new Error(`[${this.name}] Tokenizer not loaded — call load() first.`);
    }
    const hf = this.tokenizer as unknown as { tokenize(input: string): string[] };
    return hf.tokenize(text);
  }

  // Lazily fetches the head matrices once per session. Non-fatal: the
  // decomposition section simply hides when the sidecar is unavailable.
  async ensureHeadWeights(): Promise<HeadWeightMatrices | null> {
    if (this.headWeights) return this.headWeights;
    this.headWeights = await loadHeadWeights(
      this.modelDir,
      getHfFileUrl(this.config.hfRepo, "head_weights.json"),
      this.config.cacheKey,
    );
    return this.headWeights;
  }

  // Direct low-level inference on pre-encoded tensors (Module 3).
  async predictEncoded(encoding: FeedbackEncoding): Promise<Prediction> {
    if (!this.session || !this.labelMap) {
      throw new Error(`[${this.name}] Adapter not loaded — call load() first.`);
    }

    const seqLen = encoding.inputIds.length;
    const runtime = await initOrt();
    const feeds: Record<string, Tensor> = {
      input_ids: new runtime.Tensor("int64", encoding.inputIds, [1, seqLen]),
      attention_mask: new runtime.Tensor("int64", encoding.attentionMask, [1, seqLen]),
    };

    // Requested outputs only: avoids materialising the ~43 MB attention and
    // hidden-state tensors on the hot batch path.
    const results = await this.session.run(feeds, LOGIT_OUTPUTS);

    const issueProbs = softmax(results["issue_logits"].data as Float32Array);
    const polarityProbs = softmax(results["polarity_logits"].data as Float32Array);

    const issueIdx = argmax(issueProbs);
    const polarityIdx = argmax(polarityProbs);

    const rawIssue = this.labelMap.issue.id2label[String(issueIdx)] ?? "Uncategorized";
    let issue = applyConfidenceFallback(rawIssue, issueProbs[issueIdx]);
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

  // Diagnostic inference used by the Algorithm Simulation. Runs the full ONNX
  // graph in a single pass and surfaces the raw logits, the full softmax
  // distribution, the top-K ranked predictions, and the encoder internals
  // (attention, hidden states, pooled vector) for the Phase 3 workbench.
  async predictEncodedDiagnostics(encoding: FeedbackEncoding): Promise<{
    issue: string;
    polarity: string;
    confidence: number;
    rawIssue: string;
    rawConfidence: number;
    routedDueToLowConfidence: boolean;
    confidenceThreshold: number;
    issueLogitsRaw: number[];
    polarityLogitsRaw: number[];
    topKIssues: Array<{
      id: number;
      label: string;
      logit: number;
      probability: number;
      deltaFromTop?: number;
    }>;
    polarityDistribution: Array<{ label: string; logit: number; probability: number }>;
    internals: ModelInternals;
  }> {
    if (!this.session || !this.labelMap) {
      throw new Error(`[${this.name}] Adapter not loaded — call load() first.`);
    }

    const seqLen = encoding.inputIds.length;
    const runtime = await initOrt();
    const feeds: Record<string, Tensor> = {
      input_ids: new runtime.Tensor("int64", encoding.inputIds, [1, seqLen]),
      attention_mask: new runtime.Tensor("int64", encoding.attentionMask, [1, seqLen]),
    };

    const results = await this.session.run(feeds, FULL_OUTPUTS);

    const headWeights = await this.ensureHeadWeights();
    const attentionTensor = results["attentions"];
    const internals = buildModelInternals(
      {
        attentions: attentionTensor.data as Float32Array,
        hiddenStates: results["hidden_states"].data as Float32Array,
        pooled: results["pooled_output"].data as Float32Array,
        attentionMask: encoding.attentionMask,
        seqLen: Number(attentionTensor.dims[3] ?? seqLen),
      },
      headWeights ?? undefined,
    );

    const issueLogits = Array.from(results["issue_logits"].data as Float32Array);
    const polarityLogits = Array.from(results["polarity_logits"].data as Float32Array);

    const issueProbs = softmax(results["issue_logits"].data as Float32Array);
    const polarityProbs = softmax(results["polarity_logits"].data as Float32Array);

    const issueIdx = argmax(issueProbs);
    const polarityIdx = argmax(polarityProbs);

    const rawIssue = this.labelMap.issue.id2label[String(issueIdx)] ?? "Uncategorized";
    const rawConfidence = issueProbs[issueIdx];
    const routedDueToLowConfidence = rawConfidence < CONFIDENCE_FALLBACK_THRESHOLD;
    let issue = routedDueToLowConfidence ? "Uncategorized" : rawIssue;
    if (issue === "uncategorized") {
      issue = "Uncategorized";
    }
    const polarity = (this.labelMap.polarity.id2label[String(polarityIdx)] ??
      "neu") as Prediction["polarity"];

    // Rank all issue classes by softmax probability, keep the top 5.
    const ranked = issueLogits
      .map((logit, i) => ({
        id: i,
        label: this.labelMap!.issue.id2label[String(i)] ?? `class_${i}`,
        logit,
        probability: issueProbs[i],
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5)
      .map((entry, i, arr) => ({
        ...entry,
        deltaFromTop: i === 0 ? 0 : arr[0].probability - entry.probability,
      }));

    const polarityDistribution = polarityLogits.map((logit, i) => ({
      label: this.labelMap?.polarity.id2label[String(i)] ?? `class_${i}`,
      logit,
      probability: polarityProbs[i],
    }));

    return {
      issue,
      polarity,
      confidence: rawConfidence,
      rawIssue,
      rawConfidence,
      routedDueToLowConfidence,
      confidenceThreshold: CONFIDENCE_FALLBACK_THRESHOLD,
      issueLogitsRaw: issueLogits,
      polarityLogitsRaw: polarityLogits,
      topKIssues: ranked,
      polarityDistribution,
      internals,
    };
  }

  async dispose(): Promise<void> {
    await this.session?.release();
    this.session = null;
  }
}
