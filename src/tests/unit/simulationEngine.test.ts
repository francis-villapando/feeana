import { beforeAll, describe, expect, it } from "vitest";
import { PRESETS } from "../../components/dev/simulationPresets";
import { getMLWorkerAsync } from "../../lib/ml/mlWorkerStore";
import { mapDiagnostics, computePriority, buildCue } from "../../components/dev/simulationEngine";
import { HIDDEN_SIZE, NUM_HEADS, NUM_LAYERS } from "../../lib/algorithm/internals";

const EXPECTED: Record<
  string,
  {
    issue: string;
    isGap: boolean;
    priorityScore: number;
    triggersRecommendation: boolean;
    isExcluded: boolean;
  }
> = {
  "Intrinsic Gap (Recommendation)": {
    issue: "abstract logic gap",
    isGap: true,
    priorityScore: 0.45,
    triggersRecommendation: true,
    isExcluded: false,
  },
  "Extraneous (Recommendation)": {
    issue: "instructional cadence",
    isGap: false,
    priorityScore: 0.4,
    triggersRecommendation: true,
    isExcluded: false,
  },
  "Intrinsic Non-Gap (Recommendation)": {
    issue: "design synthesis failure",
    isGap: false,
    priorityScore: 0.3,
    triggersRecommendation: true,
    isExcluded: false,
  },
  "Gap Multiplier Boost": {
    issue: "procedural bottleneck",
    isGap: true,
    priorityScore: 0.3,
    triggersRecommendation: true,
    isExcluded: false,
  },
  "Intrinsic (Warning)": {
    issue: "notation struggle",
    isGap: true,
    priorityScore: 0.15,
    triggersRecommendation: false,
    isExcluded: false,
  },
  "Extraneous (Warning)": {
    issue: "peer distraction",
    isGap: false,
    priorityScore: 0.1,
    triggersRecommendation: false,
    isExcluded: false,
  },
  "Uncategorized Feedback": {
    issue: "Uncategorized",
    isGap: false,
    priorityScore: 0,
    triggersRecommendation: false,
    isExcluded: true,
  },
  "Low-Confidence Fallback (Uncategorized)": {
    issue: "Uncategorized",
    isGap: false,
    priorityScore: 0,
    triggersRecommendation: false,
    isExcluded: true,
  },
};

describe("model-backed preset simulation", () => {
  beforeAll(async () => {
    const { api } = await getMLWorkerAsync();
    await api.preloadModel();
  }, 180_000);

  for (const preset of PRESETS) {
    it(`predicts "${EXPECTED[preset.label].issue}" and produces the expected strategy for "${preset.label}"`, async () => {
      const { api } = await getMLWorkerAsync();
      const extraction = await api.extractSingle({
        id: "simulation",
        rawText: preset.input.feedbackText,
      });

      const expected = EXPECTED[preset.label];
      expect(extraction.issue).toBe(expected.issue);

      // Encoder internals must ride along on every extractSingle result so the
      // workbench always has activations to render.
      const { internals } = extraction;
      expect(internals.activeTokens).toBeGreaterThan(1);
      expect(internals.attention.length).toBe(
        NUM_LAYERS * NUM_HEADS * internals.activeTokens * internals.activeTokens,
      );
      expect(internals.hiddenStates.length).toBe(
        (NUM_LAYERS + 1) * internals.activeTokens * HIDDEN_SIZE,
      );
      expect(internals.pooled).toHaveLength(HIDDEN_SIZE);
      for (const entry of extraction.topKIssues) {
        expect(entry.id).toBeGreaterThanOrEqual(0);
        expect(entry.id).toBeLessThan(extraction.issueLogitsRaw.length);
      }

      if (preset.label === "Low-Confidence Fallback (Uncategorized)") {
        expect(extraction.routedDueToLowConfidence).toBe(true);
        expect(extraction.confidenceThreshold).toBe(0.31);
        expect(extraction.rawConfidence).toBeLessThan(0.31);
        expect(typeof extraction.rawIssue).toBe("string");
      }

      const diag = mapDiagnostics(extraction.issue, preset.input.targetRbt);
      const strat = computePriority(
        extraction.issue,
        preset.input.issueOccurrences,
        preset.input.totalFeedback,
        diag.isGap,
      );
      const cue = buildCue(preset.input, extraction.issue, diag, preset.input.issueOccurrences);

      expect(diag.isGap).toBe(expected.isGap);
      expect(strat.priorityScore).toBeCloseTo(expected.priorityScore, 2);
      expect(strat.triggersRecommendation).toBe(expected.triggersRecommendation);
      expect(strat.isExcluded).toBe(expected.isExcluded);

      if (expected.isExcluded) {
        expect(cue).toBeNull();
      } else {
        expect(cue).not.toBeNull();
        expect(cue?.issue).toBe(expected.issue);
      }
    }, 60_000);
  }
});
