// This file runs in a Web Worker — no DOM, React, or browser-only imports allowed.
import * as Comlink from "comlink";
import { env } from "@huggingface/transformers";
import { runAlgorithmPipeline } from "./pipeline";
import type { SessionContext, FeedbackInput, PipelineOutput } from "./types";
import { getClassifier } from "./informationExtraction";

// Configure transformers.js environment for browser use
env.allowLocalModels = false;

// Use native postMessage for progress events to avoid Comlink proxy jank
let lastProgressTime = 0;
const THROTTLE_MS = 66; // ~15 FPS

// Listen to transformers.js progress callbacks and throttle them to the main thread
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/';
}

// Implement the worker API
const api = {
  async run(
    sessionContext: SessionContext,
    feedbackStream: FeedbackInput[]
  ): Promise<PipelineOutput> {
    console.debug("[worker] Executing pipeline in background thread.");
    // Run the pipeline
    const output = await runAlgorithmPipeline(sessionContext, feedbackStream);
    return output;
  },

  // Method to trigger initialization with a progress callback
  async preloadModel(): Promise<void> {
    console.log("[worker] Preloading model...");
    await getClassifier((info: any) => {
      const now = performance.now();
      // Throttle updates unless it's a completion event
      if (info.status === 'done' || now - lastProgressTime > THROTTLE_MS) {
        lastProgressTime = now;
        self.postMessage({ type: 'progress', data: info });
      }
    });
  }
};

export type WorkerApi = typeof api;

Comlink.expose(api);
