// Web Worker — runs Modules 2-3-4 (preprocess → ML inference → diagnostic mapping).
// No DOM, React, or browser-only imports allowed.

import * as Comlink from "comlink";
import { env } from "@huggingface/transformers";
import { Preprocess } from "./preprocess";
import { ExtractPID, getClassifier } from "./informationExtraction";
import { buildDiagnosticRecord } from "./pedagogicalDiagnosticMapping";
import type { FeedbackInput, DiagnosticRecord } from "./types";

env.allowLocalModels = true;

// Attempt GPU (WebGL) acceleration; fallback to CPU (WASM) if unavailable
try {
  env.backends.onnx.backend = "webgl";
} catch {
  // WebGL not supported — WASM fallback is automatic
}

let lastProgressTime = 0;
const THROTTLE_MS = 66;

const api = {
  async runInference(
    feedbackStream: FeedbackInput[],
    _targetIloRbt: number,
  ): Promise<DiagnosticRecord[]> {
    console.debug("[worker] Running Modules 2-3-4 per-feedback loop.");
    const results: DiagnosticRecord[] = [];

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

      const cleanText = Preprocess(feedback);
      performance.mark(`extract:entry-${i}-start`);
      const extraction = await ExtractPID(cleanText);
      performance.mark(`extract:entry-${i}-end`);
      performance.measure(`Entry inference #${i}`, {
        start: `extract:entry-${i}-start`,
        end: `extract:entry-${i}-end`,
        detail: { targetMs: 8000 },
      });
      results.push(
        buildDiagnosticRecord(extraction.issue, extraction.polarity, _targetIloRbt, feedback.id),
      );
    }

    return results;
  },

  async preloadModel(): Promise<void> {
    console.log("[worker] Preloading model...");
    await getClassifier((info: any) => {
      const now = performance.now();
      if (info.status === "done" || now - lastProgressTime > THROTTLE_MS) {
        lastProgressTime = now;
        self.postMessage({ type: "LOAD_PROGRESS", data: info });
      }
    });
    self.postMessage({ type: "LOAD_PROGRESS", data: { status: "done", progress: 100 } });
  },
};

export type WorkerApi = typeof api;

Comlink.expose(api);
