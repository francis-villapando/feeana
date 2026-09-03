// Web Worker — runs Modules 2-3-4 (preprocess → ML inference → diagnostic mapping).
// No DOM, React, or browser-only imports allowed.

import * as Comlink from "comlink";
import { env } from "@huggingface/transformers";
import { Preprocess, EncodeFeedback, inspectPreprocessingSteps, MAX_SEQ_LEN } from "./preprocess";
import { ExtractPID, getClassifier } from "./informationExtraction";
import { buildDiagnosticRecord } from "./pedagogicalDiagnosticMapping";
import type { FeedbackInput, DiagnosticRecord } from "./types";
import type { LoadProgress } from "./models/finetuned";

env.allowLocalModels = true;

let lastProgressTime = 0;
let lastPhase: string | undefined;
let lastSource: "cache" | "network" | undefined;
const THROTTLE_MS = 66;

// Shared, throttled LOAD_PROGRESS emitter. Used by every entry point that
// triggers a classifier load so warm/cold progress always reaches the UI.
function notifyLoadProgress(info: LoadProgress): void {
  const now = performance.now();
  const phaseChanged = info.phase !== lastPhase;
  const sourceChanged = info.source !== lastSource;
  // Throttle progress events while preserving phase/source transitions and completion.
  if (
    info.status === "done" ||
    phaseChanged ||
    sourceChanged ||
    now - lastProgressTime > THROTTLE_MS
  ) {
    lastProgressTime = now;
    lastPhase = info.phase;
    lastSource = info.source;
    self.postMessage({ type: "LOAD_PROGRESS", data: info });
  }
}

export interface InferenceProgress {
  current: number;
  total: number;
  text: string;
}

let preloadPromise: Promise<void> | null = null;

const api = {
  async runInference(
    feedbackStream: FeedbackInput[],
    _targetIloRbt: number,
  ): Promise<DiagnosticRecord[]> {
    console.debug("[worker] Running Modules 2-3-4 per-feedback loop.");
    const results: DiagnosticRecord[] = [];

    // Invariant: the classifier and its tokenizer must be fully initialized
    // before the loop; a failed cold-start aborts before any feedback runs.
    const classifier = await getClassifier(notifyLoadProgress);
    if (!classifier.tokenizer) {
      throw new Error("[worker] Tokenizer unavailable — model failed to load.");
    }

    for (let i = 0; i < feedbackStream.length; i++) {
      const feedback = feedbackStream[i];

      self.postMessage({
        type: "INFERENCE_PROGRESS",
        payload: {
          current: i + 1,
          total: feedbackStream.length,
          text: feedback.rawText.slice(0, 60),
        },
      });

      // Module 2: Preprocessing (algorithm.pseudo L9)
      const preprocessResult = Preprocess(feedback, classifier.tokenizer);

      // Module 3: Information Extraction (algorithm.pseudo L10)
      performance.mark(`extract:entry-${i}-start`);
      const extraction = await ExtractPID(preprocessResult.encoding);
      performance.mark(`extract:entry-${i}-end`);
      performance.measure(`Entry inference #${i}`, {
        start: `extract:entry-${i}-start`,
        end: `extract:entry-${i}-end`,
        detail: { targetMs: 2000 },
      });
      results.push(
        buildDiagnosticRecord(extraction.issue, extraction.polarity, _targetIloRbt, feedback.id),
      );
    }

    return results;
  },

  async preloadModel(): Promise<void> {
    if (preloadPromise) {
      return preloadPromise;
    }
    preloadPromise = (async () => {
      console.log("[worker] Preloading model...");
      await getClassifier(notifyLoadProgress);
      self.postMessage({ type: "LOAD_PROGRESS", data: { status: "done", progress: 100 } });
    })().finally(() => {
      preloadPromise = null;
    });
    return preloadPromise;
  },

  // Tokenization and tensor encoding used by Phase 2 Preprocessing visualization.
  async tokenizeSingle(rawText: string): Promise<{
    subwords: string[];
    inputIdsPreview: number[];
    attentionMaskPreview: number[];
    totalTokens: number;
    maxLength: number;
    dataType: string;
    tensorShape: [number, number];
  }> {
    const classifier = await getClassifier(notifyLoadProgress);
    if (!classifier.tokenizer) {
      throw new Error("[worker] Tokenizer unavailable — model failed to load.");
    }

    const preprocessing = inspectPreprocessingSteps(rawText);
    const encoding = EncodeFeedback(preprocessing.cleanedText, classifier.tokenizer);

    const inputIds = Array.from(encoding.inputIds).map(Number);
    const attentionMask = Array.from(encoding.attentionMask).map(Number);
    const totalTokens = attentionMask.filter((v) => v === 1).length;

    return {
      subwords: classifier.tokenize(preprocessing.cleanedText),
      inputIdsPreview: inputIds,
      attentionMaskPreview: attentionMask,
      totalTokens,
      maxLength: MAX_SEQ_LEN,
      dataType: "int64",
      tensorShape: [1, MAX_SEQ_LEN],
    };
  },

  // Single-feedback extraction used by the Algorithm Simulation (Module 3).
  // Surfaces the model confidence that ExtractPID discards, plus the full
  // preprocessing timeline, tokenization, and logit telemetry for visualization.
  async extractSingle(feedback: FeedbackInput): Promise<{
    cleanedText: string;
    issue: string;
    polarity: string;
    confidence: number;
    latencyMs: number;
    preprocessing: {
      rawText: string;
      afterNoise: string;
      afterVowels: string;
      afterAbbrevs: string;
      cleanedText: string;
    };
    tokenization: {
      subwords: string[];
      inputIdsPreview: number[];
      attentionMaskPreview: number[];
      totalTokens: number;
      maxLength: number;
      dataType: string;
      tensorShape: [number, number];
    };
    issueLogitsRaw: number[];
    polarityLogitsRaw: number[];
    topKIssues: Array<{
      label: string;
      logit: number;
      probability: number;
      deltaFromTop?: number;
    }>;
    polarityDistribution: Array<{ label: string; logit: number; probability: number }>;
    executionMeta: {
      modelName: string;
      runtime: string;
      sequenceLength: number;
      latencyMs: number;
    };
  }> {
    const classifier = await getClassifier(notifyLoadProgress);
    if (!classifier.tokenizer) {
      throw new Error("[worker] Tokenizer unavailable — model failed to load.");
    }

    const t0 = performance.now();
    const preprocessing = inspectPreprocessingSteps(feedback.rawText);
    const encoding = EncodeFeedback(preprocessing.cleanedText, classifier.tokenizer);

    // Convert BigInt64Array to plain number[] — BigInt64Array is not
    // structured-clone-safe across the Comlink worker boundary. Return the
    // full 256-length tensors (including padding zeros) so the complete
    // encoding is visible in the lab UI.
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
};

export type WorkerApi = typeof api;

Comlink.expose(api);
