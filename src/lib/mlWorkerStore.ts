import * as Comlink from "comlink";
import type { WorkerApi } from "./algorithm/worker";

let workerInstance: Worker | null = null;
let comlinkProxy: Comlink.Remote<WorkerApi> | null = null;
let progressCallback: ((data: any) => void) | null = null;
let downloadProgressCallback: ((data: any) => void) | null = null;

export const setInferenceProgressListener = (callback: typeof progressCallback) => {
  progressCallback = callback;
};

export const setDownloadProgressListener = (callback: typeof downloadProgressCallback) => {
  downloadProgressCallback = callback;
};

/**
 * Returns a globally cached instance of the ML Worker and its Comlink proxy.
 * This prevents re-initializing the heavy Transformers.js runtime across route transitions.
 */
export function getMLWorker(): {
  worker: Worker;
  api: Comlink.Remote<WorkerApi>;
} {
  if (!workerInstance || !comlinkProxy) {
    console.debug("[mlWorkerStore] Initializing new Web Worker instance.");
    // Instantiate the worker using Vite's native worker import syntax
    workerInstance = new Worker(new URL("./algorithm/worker.ts", import.meta.url), {
      type: "module",
    });

    workerInstance.addEventListener('message', (event) => {
      if (event.data?.type === 'INFERENCE_PROGRESS') {
        progressCallback?.(event.data.payload);
      } else if (event.data?.type === 'progress') {
        downloadProgressCallback?.(event.data.data);
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
