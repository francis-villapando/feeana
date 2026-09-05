import * as Comlink from "comlink";
import type { WorkerApi, InferenceProgress } from "../algorithm/worker";
import type { LoadProgress } from "../algorithm/models/distilXlmr";
import { deleteLegacyModelCaches } from "../algorithm/models/modelCache";

let workerInstance: Worker | null = null;
let comlinkProxy: Comlink.Remote<WorkerApi> | null = null;
let progressCallback: ((data: InferenceProgress) => void) | null = null;
let loadProgressCallback: ((data: LoadProgress) => void) | null = null;
let lastLoadProgress: LoadProgress | null = null;

// Retain the latest load progress so late subscribers render the current
// state instead of the indeterminate spinner during a cold download.
function publishLoadProgress(info: LoadProgress): void {
  lastLoadProgress = info;
  loadProgressCallback?.(info);
}

export const setInferenceProgressListener = (callback: typeof progressCallback) => {
  progressCallback = callback;
  return () => {
    if (progressCallback === callback) progressCallback = null;
  };
};

export const setLoadProgressListener = (callback: typeof loadProgressCallback) => {
  loadProgressCallback = callback;
  if (lastLoadProgress) {
    callback?.(lastLoadProgress);
  }
  return () => {
    if (loadProgressCallback === callback) loadProgressCallback = null;
  };
};

const isBrowser = typeof Worker !== "undefined";

// --- Node.js fallback: runs inference inline without Web Workers ---

let nodeApi: WorkerApi | null = null;

async function getNodeApi(): Promise<WorkerApi> {
  if (nodeApi) return nodeApi;

  const { Preprocess } = await import("../algorithm/preprocess");
  const { ExtractPID, getClassifier } = await import("../algorithm/informationExtraction");
  const { buildDiagnosticRecord } = await import("../algorithm/pedagogicalDiagnosticMapping");

  nodeApi = {
    async runInference(
      feedbackStream: { id: string; rawText: string; createdAt?: string }[],
      _targetIloRbt: number,
    ) {
      console.debug("[mlWorkerStore:node] Running Modules 2-3-4 inline (no Web Worker).");
      // Invariant: the classifier and its tokenizer must be fully initialized
      // before the loop; a failed cold-start aborts before any feedback runs.
      const classifier = await getClassifier((info) => {
        publishLoadProgress(info);
      });
      if (!classifier.tokenizer) {
        throw new Error("[mlWorkerStore:node] Tokenizer unavailable — model failed to load.");
      }
      const results: {
        feedbackId?: string;
        issue: string;
        polarity: string;
        tti: string;
        rbt: number;
        clt: "Intrinsic" | "Extraneous";
        isGap: boolean;
      }[] = [];

      for (let i = 0; i < feedbackStream.length; i++) {
        const feedback = feedbackStream[i];
        // Module 2: Preprocessing (algorithm.pseudo L9)
        const preprocessResult = Preprocess(feedback, classifier.tokenizer);
        performance.mark(`node:extract:${i}-start`);
        // Module 3: Information Extraction (algorithm.pseudo L10)
        const extraction = await ExtractPID(preprocessResult.encoding);
        performance.mark(`node:extract:${i}-end`);
        performance.measure(`Node entry inference #${i}`, {
          start: `node:extract:${i}-start`,
          end: `node:extract:${i}-end`,
        });
        results.push(
          buildDiagnosticRecord(extraction.issue, extraction.polarity, _targetIloRbt, feedback.id),
        );
      }
      return results;
    },
    async preloadModel() {
      console.log("[mlWorkerStore:node] Preloading model inline...");
      await getClassifier((info) => {
        publishLoadProgress(info);
      });
    },
    async extractSingle(feedback: { id: string; rawText: string; createdAt?: string }) {
      const classifier = await getClassifier((info) => {
        publishLoadProgress(info);
      });
      if (!classifier.tokenizer) {
        throw new Error("[mlWorkerStore:node] Tokenizer unavailable — model failed to load.");
      }
      const { Preprocess, EncodeFeedback, inspectPreprocessingSteps, MAX_SEQ_LEN } =
        await import("../algorithm/preprocess");
      const t0 = performance.now();
      const preprocessing = inspectPreprocessingSteps(feedback.rawText);
      const encoding = EncodeFeedback(preprocessing.cleanedText, classifier.tokenizer);

      const inputIds = Array.from(encoding.inputIds).map(Number);
      const attentionMask = Array.from(encoding.attentionMask).map(Number);
      const totalTokens = attentionMask.filter((v) => v === 1).length;

      const tokenization = {
        subwords: classifier.tokenize(preprocessing.cleanedText),
        inputIdsPreview: inputIds,
        attentionMaskPreview: attentionMask,
        totalTokens,
        maxLength: MAX_SEQ_LEN,
        dataType: "int64",
        tensorShape: [1, MAX_SEQ_LEN] as [number, number],
      };

      const diagnostics = await classifier.predictEncodedDiagnostics(encoding);
      const latencyMs = performance.now() - t0;

      return {
        cleanedText: preprocessing.cleanedText,
        issue: diagnostics.issue,
        polarity: diagnostics.polarity,
        confidence: diagnostics.confidence,
        rawIssue: diagnostics.rawIssue,
        rawConfidence: diagnostics.rawConfidence,
        routedDueToLowConfidence: diagnostics.routedDueToLowConfidence,
        confidenceThreshold: diagnostics.confidenceThreshold,
        latencyMs,
        preprocessing,
        tokenization,
        issueLogitsRaw: diagnostics.issueLogitsRaw,
        polarityLogitsRaw: diagnostics.polarityLogitsRaw,
        topKIssues: diagnostics.topKIssues,
        polarityDistribution: diagnostics.polarityDistribution,
        executionMeta: {
          modelName: "DistilXLM-R (int8 quantized)",
          runtime: "ONNX Runtime Web (WASM SIMD Multi-threaded)",
          sequenceLength: MAX_SEQ_LEN,
          latencyMs,
        },
      };
    },
  } as WorkerApi;

  return nodeApi;
}

/**
 * Returns a globally cached instance of the ML Worker and its Comlink proxy.
 * This prevents re-initializing the heavy Transformers.js runtime across route transitions.
 *
 * In Node.js (no Worker support), runs inference inline on the main thread.
 */
export async function getMLWorkerAsync(): Promise<{
  worker: Worker | null;
  api: Comlink.Remote<WorkerApi> | WorkerApi;
}> {
  if (isBrowser) {
    return getMLWorker();
  }
  return { worker: null, api: await getNodeApi() };
}

/**
 * Returns a globally cached instance of the ML Worker and its Comlink proxy.
 * This prevents re-initializing the heavy Transformers.js runtime across route transitions.
 *
 * Browser-only — throws if Worker is unavailable. Use getMLWorkerAsync() for Node.js support.
 */
export function getMLWorker(): {
  worker: Worker;
  api: Comlink.Remote<WorkerApi>;
} {
  if (!workerInstance || !comlinkProxy) {
    console.debug("[mlWorkerStore] Initializing new Web Worker instance.");
    // One-time, non-blocking cleanup of the legacy pre-rename cache keys.
    // The model re-downloads once under its descriptive cache name.
    void deleteLegacyModelCaches();
    // Instantiate the worker using Vite's native worker import syntax.
    workerInstance = new Worker(new URL("../algorithm/worker.ts", import.meta.url), {
      type: "module",
    });

    workerInstance.addEventListener("message", (event) => {
      if (event.data?.type === "INFERENCE_PROGRESS") {
        progressCallback?.(event.data.payload);
      } else if (event.data?.type === "LOAD_PROGRESS") {
        publishLoadProgress(event.data.data);
      }
    });

    comlinkProxy = Comlink.wrap<WorkerApi>(workerInstance);
  }

  return { worker: workerInstance, api: comlinkProxy };
}

/**
 * Clears the worker instance. Useful for memory management if we ever need
 * to completely tear down the background thread.
 */
export function terminateMLWorker() {
  if (workerInstance) {
    console.debug("[mlWorkerStore] Terminating Web Worker instance.");
    workerInstance.terminate();
    workerInstance = null;
    comlinkProxy = null;
  }
}
