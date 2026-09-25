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
import { PRESETS } from "../../components/dev/simulationPresets";
import { CleanFeedback, inspectPreprocessingSteps } from "../../lib/algorithm/preprocess";
import { RBT_LEVELS } from "../../lib/algorithm/rules";

const EXPECTED_BLOOM_CONTRACT: Record<
  string,
  { iloStatement: string; targetRbt: number; rbtLabel: string }
> = {
  "Intrinsic Gap (Recommendation)": {
    iloStatement:
      "Design and develop recursive algorithms to solve complex computational problems using divide-and-conquer strategies.",
    targetRbt: 6,
    rbtLabel: "Create",
  },
  "Extraneous (Recommendation)": {
    iloStatement:
      "Apply singly linked list operations to implement solutions for given programming problems.",
    targetRbt: 3,
    rbtLabel: "Apply",
  },
  "Intrinsic Non-Gap (Recommendation)": {
    iloStatement: "Implement a working program from a given algorithm specification.",
    targetRbt: 3,
    rbtLabel: "Apply",
  },
  "Gap Multiplier Boost": {
    iloStatement:
      "Analyze sorting algorithms to determine which approach is appropriate for a given data set and problem requirement.",
    targetRbt: 4,
    rbtLabel: "Analyze",
  },
  "Intrinsic (Warning)": {
    iloStatement: "Apply standard logical notation when interpreting mathematical proofs.",
    targetRbt: 3,
    rbtLabel: "Apply",
  },
  "Extraneous (Warning)": {
    iloStatement:
      "Apply in-order and pre-order traversal algorithms to obtain the required node sequences of binary trees.",
    targetRbt: 3,
    rbtLabel: "Apply",
  },
  "Uncategorized Feedback": {
    iloStatement:
      "Analyze graph operations and constraints to select an adjacency-list or adjacency-matrix representation for a graph.",
    targetRbt: 4,
    rbtLabel: "Analyze",
  },
  "Low-Confidence Fallback (Uncategorized)": {
    iloStatement: "Apply core programming constructs to implement simple programs.",
    targetRbt: 3,
    rbtLabel: "Apply",
  },
};

describe("simulation preset Bloom contracts", () => {
  it("pairs every preset with its intended ILO and RBT", () => {
    expect(PRESETS).toHaveLength(Object.keys(EXPECTED_BLOOM_CONTRACT).length);

    for (const preset of PRESETS) {
      const expected = EXPECTED_BLOOM_CONTRACT[preset.label];
      expect(expected, preset.label).toBeDefined();
      expect(preset.input.iloStatement, preset.label).toBe(expected.iloStatement);
      expect(preset.input.targetRbt, preset.label).toBe(expected.targetRbt);
      expect(RBT_LEVELS[expected.targetRbt], preset.label).toBe(expected.rbtLabel);
    }
  });

  it("uses valid target RBT values", () => {
    for (const preset of PRESETS) {
      expect(Number.isInteger(preset.input.targetRbt), preset.label).toBe(true);
      expect(preset.input.targetRbt, preset.label).toBeGreaterThanOrEqual(1);
      expect(preset.input.targetRbt, preset.label).toBeLessThanOrEqual(RBT_LEVELS.length - 1);
    }
  });
});

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
