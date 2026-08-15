import * as Comlink from "comlink";
import type { WorkerApi } from "../algorithm/worker";

let workerInstance: Worker | null = null;
let comlinkProxy: Comlink.Remote<WorkerApi> | null = null;
let progressCallback: ((data: any) => void) | null = null;
let loadProgressCallback: ((data: any) => void) | null = null;

export const setInferenceProgressListener = (callback: typeof progressCallback) => {
  progressCallback = callback;
};

export const setLoadProgressListener = (callback: typeof loadProgressCallback) => {
  loadProgressCallback = callback;
};

const isBrowser = typeof Worker !== "undefined";

// --- Node.js fallback: runs inference inline without Web Workers ---

let nodeApi: WorkerApi | null = null;

async function getNodeApi(): Promise<WorkerApi> {
  if (nodeApi) return nodeApi;

  const { Preprocess } = await import("../algorithm/preprocess");
  const { ExtractPID, getClassifier } = await import("../algorithm/informationExtraction");
  const { map_tti, map_rbt, map_clt } = await import("../algorithm/pedagogicalDiagnosticMapping");

  nodeApi = {
    async runInference(
      feedbackStream: { id: string; rawText: string; createdAt?: string }[],
      _targetIloRbt: number,
    ) {
      console.debug("[mlWorkerStore:node] Running Modules 2-3-4 inline (no Web Worker).");
      await getClassifier((info: any) => {
        progressCallback?.(info);
        loadProgressCallback?.(info);
      });
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
        const cleanText = Preprocess(feedback);
        performance.mark(`node:extract:${i}-start`);
        const extraction = await ExtractPID(cleanText);
        performance.mark(`node:extract:${i}-end`);
        performance.measure(`Node entry inference #${i}`, {
          start: `node:extract:${i}-start`,
          end: `node:extract:${i}-end`,
        });
        results.push({
          feedbackId: feedback.id,
          issue: extraction.issue,
          polarity: extraction.polarity,
          tti: map_tti(extraction.issue),
          rbt: map_rbt(extraction.issue),
          clt: map_clt(extraction.issue),
          isGap: extraction.issue !== "Uncategorized",
        });
      }
      return results;
    },
    async preloadModel() {
      console.log("[mlWorkerStore:node] Preloading model inline...");
      await getClassifier((info: any) => {
        progressCallback?.(info);
        loadProgressCallback?.(info);
      });
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
    // Instantiate the worker using Vite's native worker import syntax
    workerInstance = new Worker(new URL("../algorithm/worker.ts", import.meta.url), {
      type: "module",
    });

    workerInstance.addEventListener("message", (event) => {
      if (event.data?.type === "INFERENCE_PROGRESS") {
        progressCallback?.(event.data.payload);
      } else if (event.data?.type === "LOAD_PROGRESS") {
        loadProgressCallback?.(event.data.data);
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
