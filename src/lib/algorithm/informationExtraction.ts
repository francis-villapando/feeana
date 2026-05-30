/*
 * Module 3: Information Extraction.
 * This file uses the local Transformers.js model to extract issue and polarity
 * from cleaned feedback text using zero-shot classification.
 * Note: This module is intended to run inside the Web Worker.
 */

import { pipeline, type PipelineType } from "@huggingface/transformers";
import type { IssueExtractionResult } from "./types";

// The 14 official taxonomy tags for zero-shot classification candidate labels.
const CANDIDATE_LABELS = [
  "relational coldness",
  "classroom tension",
  "evaluation unfairness",
  "perceived marginalization",
  "subject alienation",
  "peer distraction",
  "instructional cadence",
  "clarity deficit",
  "abstract logic gap",
  "procedural bottleneck",
  "conceptual misalignment",
  "design synthesis failure",
  "feedback latency",
  "notation struggle",
];

// Singleton classifier instance inside the worker
let classifierPromise: Promise<any> | null = null;

/**
 * Initializes or returns the existing zero-shot classification pipeline.
 */
export async function getClassifier(progress_callback?: (info: any) => void) {
  if (!classifierPromise) {
    console.log("[informationExtraction] Initializing zero-shot-classification pipeline...");
    // Fallback model or explicit model selection can be made here.
    classifierPromise = pipeline(
      "zero-shot-classification" as PipelineType,
      "Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7",
      progress_callback ? { progress_callback } : undefined
    );
  }
  return classifierPromise;
}

/**
 * Asynchronously extracts the pedagogical issue from text.
 * Mapped implicitly to negative polarity per system design.
 */
export async function ExtractPID(cleanText: string): Promise<IssueExtractionResult> {
  console.debug("[informationExtraction] Extracting PID via Zero-Shot ML", {
    cleanTextLength: cleanText.length,
  });

  try {
    const classifier = await getClassifier();
    
    // We pass multi_label: false so the scores sum to 1.
    const result = await classifier(cleanText, CANDIDATE_LABELS, {
      multi_label: false,
    });

    console.debug("[informationExtraction] Zero-Shot ML Result", {
      topLabel: result.labels[0],
      topScore: result.scores[0],
    });

    return {
      issue: result.labels[0],
      polarity: "neg", // By design, all matched issues represent negative pedagogical gaps
    };
  } catch (error) {
    console.error("[informationExtraction] Classification failed, falling back", error);
    return {
      issue: "Uncategorized",
      polarity: "neu",
    };
  }
}
