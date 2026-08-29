// Web Worker — runs Modules 2-3-4 (preprocess → ML inference → diagnostic mapping).
// No DOM, React, or browser-only imports allowed.

import * as Comlink from "comlink";
import { env } from "@huggingface/transformers";
import { Preprocess } from "./preprocess";
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
};

export type WorkerApi = typeof api;

Comlink.expose(api);
