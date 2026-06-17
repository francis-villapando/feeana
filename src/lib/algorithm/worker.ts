// Web Worker — runs Modules 2-3-4 (preprocess → ML inference → diagnostic mapping).
// No DOM, React, or browser-only imports allowed.

import * as Comlink from "comlink";
import { env } from "@huggingface/transformers";
import { Preprocess } from "./preprocess";
import { ExtractPID, getClassifier } from "./informationExtraction";
import { map_tti, map_rbt, map_clt } from "./pedagogicalDiagnosticMapping";
import type { FeedbackInput, DiagnosticRecord } from "./types";

env.allowLocalModels = false;

let lastProgressTime = 0;
const THROTTLE_MS = 66;

if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/';
}

const api = {
  async runInference(feedbackStream: FeedbackInput[], targetIloRbt: number): Promise<DiagnosticRecord[]> {
    console.debug("[worker] Running Modules 2-3-4 per-feedback loop.");
    const results: DiagnosticRecord[] = [];

    for (let i = 0; i < feedbackStream.length; i++) {
      const feedback = feedbackStream[i];

      self.postMessage({
        type: 'INFERENCE_PROGRESS',
        payload: {
          current: i + 1,
          total: feedbackStream.length,
          text: feedback.rawText.slice(0, 60),
        },
      });

      const cleanText = Preprocess(feedback);
      const extraction = await ExtractPID(cleanText);
      const tti = map_tti(extraction.issue);
      const rbt = map_rbt(extraction.issue);
      const clt = map_clt(extraction.issue);
      results.push({
        feedbackId: feedback.id,
        issue: extraction.issue,
        polarity: extraction.polarity,
        tti,
        rbt,
        clt,
        isGap: rbt <= targetIloRbt && clt === "Intrinsic",
      });
    }

    return results;
  },

  async preloadModel(): Promise<void> {
    console.log("[worker] Preloading model...");
    await getClassifier((info: any) => {
      const now = performance.now();
      if (info.status === 'done' || now - lastProgressTime > THROTTLE_MS) {
        lastProgressTime = now;
        self.postMessage({ type: 'progress', data: info });
      }
    });
    self.postMessage({ type: 'progress', data: { status: 'done', progress: 100 } });
  },
};

export type WorkerApi = typeof api;

Comlink.expose(api);
