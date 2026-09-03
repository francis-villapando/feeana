/*
 * Invariant test for the dirtified simulation presets.
 *
 * The DistilXLM-R model only ever sees the CLEANED text (preprocess always runs
 * CleanFeedback before encoding), so the dirtification must restore each preset
 * to its exact original `expectedClean` string. This guarantees the added noise
 * (emojis, @mentions, #hashtags, URLs, abbreviations, vowel elongation,
 * whitespace quirks) never changes the model's classification.
 */

import { describe, expect, it } from "vitest";
import { CleanFeedback, inspectPreprocessingSteps } from "../../lib/algorithm/preprocess";
import { PRESETS } from "../../components/dev/simulationPresets";

describe("dirtified simulation presets", () => {
  it("cleans back to the exact expected text for every preset", () => {
    for (const preset of PRESETS) {
      const cleaned = CleanFeedback(preset.input.feedbackText);
      expect(cleaned, preset.label).toBe(preset.expectedClean);
    }
  });

  it("exposes at least one meaningful preprocessing transformation per preset", () => {
    for (const preset of PRESETS) {
      const steps = inspectPreprocessingSteps(preset.input.feedbackText);
      // The dirtified text must differ from the cleaned text, otherwise the
      // preset carries no noise to demonstrate the pipeline.
      expect(steps.rawText, preset.label).not.toBe(steps.cleanedText);
    }
  });
});
