// This file runs in a Web Worker — no DOM, React, or browser-only imports allowed.
import * as Comlink from "comlink";
import { env } from "@huggingface/transformers";
import { runAlgorithmPipeline } from "./pipeline";
import type { SessionContext, FeedbackInput, PipelineOutput } from "./types";

// Configure transformers.js environment for browser use
env.allowLocalModels = false;

// We will use native postMessage for progress events to avoid Comlink proxy jank
let lastProgressTime = 0;
const THROTTLE_MS = 66; // ~15 FPS

// Listen to transformers.js progress callbacks and throttle them to the main thread
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers/dist/'; // optional: configure if necessary

// We can intercept global fetch or hook into the pipeline creation if needed, 
// but standard transformers.js pipeline() accepts a progress_callback parameter.
// We will hook into it inside getClassifier in informationExtraction if we need to.
// Actually, it's cleaner to listen to the progress_callback where the pipeline is instantiated.
// Since informationExtraction instantiates it, we can expose a setter here or pass the callback down.

// Better yet, we can expose the algorithm pipeline and it handles it internally. Wait, the pipeline 
// doesn't instantiate the model directly. To capture the progress callback cleanly across the worker,
// we can set a global callback.

// Let's implement the worker API
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
  
  // A method to manually trigger initialization with a progress callback
  async preloadModel(): Promise<void> {
    // We import this dynamically so it only runs when called, avoiding top-level await issues
    const { pipeline } = await import("@huggingface/transformers");
    
    // We do a dummy pipeline initialization to trigger the download and progress events
    console.debug("[worker] Preloading model...");
    await pipeline(
      "zero-shot-classification",
      "Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7",
      {
        progress_callback: (info: any) => {
          const now = performance.now();
          // Throttle updates unless it's a completion event
          if (info.status === 'done' || now - lastProgressTime > THROTTLE_MS) {
            lastProgressTime = now;
            self.postMessage({ type: 'progress', data: info });
          }
        }
      }
    );
  }
};

export type WorkerApi = typeof api;

Comlink.expose(api);
