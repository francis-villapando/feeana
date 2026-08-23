// Module 3: Information Extraction
// Fine-tuned DistilXLM-R PID-ABSA classification via onnxruntime-web.
// Intended to run inside the Web Worker.

import { createModel } from "./models/adapter";
import type { DistilXlmrAdapter, LoadProgress } from "./models/distilXlmr";
import type { FeedbackEncoding, IssueExtractionResult } from "./types";

// Singleton adapter instance inside the worker
let adapter: DistilXlmrAdapter | null = null;
// Cached load promise to prevent race conditions during concurrent calls.
let loadPromise: Promise<void> | null = null;

// Initializes or returns the existing DistilXLM-R adapter.
export async function getClassifier(progress_callback?: (info: LoadProgress) => void) {
  if (!adapter) {
    console.log("[informationExtraction] Initializing DistilXLM-R adapter...");
    adapter = createModel("distilxlmr") as DistilXlmrAdapter;
    if (progress_callback) {
      adapter.progressHook = progress_callback;
    }
    loadPromise = adapter.load();
    await loadPromise;
    loadPromise = null;
  } else if (loadPromise) {
    // Re-attach callback to in-flight load and await completion
    if (progress_callback) {
      adapter.progressHook = progress_callback;
    }
    await loadPromise;
  } else if (progress_callback) {
    // Rebind callback and emit ready state for warm adapter
    adapter.progressHook = progress_callback;
    progress_callback({ status: "done", progress: 100 });
  }
  return adapter;
}

// Asynchronously extracts the pedagogical issue from preprocessed numerical encoding (Module 3).
export async function ExtractPID(encoding: FeedbackEncoding): Promise<IssueExtractionResult> {
  try {
    const model = await getClassifier();
    const { issue, polarity } = await model.predictEncoded(encoding);
    return { issue, polarity };
  } catch (error) {
    console.error("[informationExtraction] Classification failed, falling back", error);
    return {
      issue: "Uncategorized",
      polarity: "neu",
    };
  }
}
