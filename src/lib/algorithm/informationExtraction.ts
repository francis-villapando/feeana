/*
 * Module 3: Information Extraction.
 * This file will use the local DistilXLM-R model to extract issue and polarity
 * from cleaned feedback text.
 */

import type { IssueExtractionResult } from "./types";

export function ExtractPID(cleanText: string): IssueExtractionResult {
  console.debug("[informationExtraction] Extracting PID", { cleanText });

  // TODO: Replace this stub with DistilXLM-R inference running offline in a worker.
  return {
    issue: cleanText,
    polarity: "neu",
  };
}
