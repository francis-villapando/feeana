// Module 3: Information Extraction
// Fine-tuned DistilXLM-R PID-ABSA classification via onnxruntime-web.
// Intended to run inside the Web Worker.

import { createModel } from "./models/adapter";
import type { DistilXlmrAdapter } from "./models/distilXlmr";
import type { IssueExtractionResult } from "./types";

// Singleton adapter instance inside the worker
let adapter: DistilXlmrAdapter | null = null;
// Cached load promise to prevent race conditions during concurrent calls.
let loadPromise: Promise<void> | null = null;

// Initializes or returns the existing DistilXLM-R adapter.
export async function getClassifier(progress_callback?: (info: any) => void) {
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
    // A load is in progress — await the same promise to avoid a race
    // where predictCleaned runs before load() finishes.
    await loadPromise;
  }
  return adapter;
}

// Asynchronously extracts the pedagogical issue from preprocessed text.
export async function ExtractPID(cleanText: string): Promise<IssueExtractionResult> {
  console.debug("[informationExtraction] Extracting PID via DistilXLM-R", {
    cleanTextLength: cleanText.length,
  });

  try {
    const model = await getClassifier();
    const { issue, polarity } = await model.predictCleaned(cleanText);
    return { issue, polarity };
  } catch (error) {
    console.error("[informationExtraction] Classification failed, falling back", error);
    return {
      issue: "Uncategorized",
      polarity: "neu",
    };
  }
}