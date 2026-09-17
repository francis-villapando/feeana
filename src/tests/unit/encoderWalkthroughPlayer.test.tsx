import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TOTAL_STEPS,
  attentionLayerIndex,
  buildNarrative,
  clampStep,
  computeTopMeanPairs,
  hiddenStateLayerIndex,
  phaseName,
  stepIntervalMs,
  stepStage,
} from "../../components/dev/internals/walkthrough";
import { EncoderWalkthroughPlayer } from "../../components/dev/internals/EncoderWalkthroughPlayer";
import {
  HIDDEN_SIZE,
  NUM_HEADS,
  NUM_LAYERS,
  type ModelInternals,
} from "../../lib/algorithm/internals";
import type { LogitDistribution } from "../../components/dev/simulationEngine";

// Synthetic internals with the same [NUM_LAYERS, NUM_HEADS, N, N] layout as the
// real payload; value(l, h, i, j) = l*100 + h*10 + i + j/10.
function makeInternals(): ModelInternals {
  const activeTokens = 3;
  const matrixSize = activeTokens * activeTokens;
  const attention = new Float32Array(NUM_LAYERS * NUM_HEADS * matrixSize);
  for (let l = 0; l < NUM_LAYERS; l++) {
    for (let h = 0; h < NUM_HEADS; h++) {
      for (let i = 0; i < activeTokens; i++) {
        for (let j = 0; j < activeTokens; j++) {
          attention[(l * NUM_HEADS + h) * matrixSize + i * activeTokens + j] =
            l * 100 + h * 10 + i + j / 10;
        }
      }
    }
  }
  const hiddenStates = new Float32Array((NUM_LAYERS + 1) * activeTokens * HIDDEN_SIZE);
  for (let l = 0; l <= NUM_LAYERS; l++) {
    for (let t = 0; t < activeTokens; t++) {
      for (let d = 0; d < HIDDEN_SIZE; d++) {
        hiddenStates[(l * activeTokens + t) * HIDDEN_SIZE + d] = l + t / 10;
      }
    }
  }
  return {
    activeTokens,
    attention,
    hiddenStates,
    pooled: new Float32Array(HIDDEN_SIZE).fill(0.25),
    layerL2: Array.from({ length: NUM_LAYERS + 1 }, (_, l) => l + 1),
    layerCosine: new Array(NUM_LAYERS).fill(0.9),
    headEntropy: new Array(NUM_LAYERS * NUM_HEADS).fill(0),
  };
}

const SUBWORDS = ["<s>", "▁maba", "▁bait"];
const TOP_ISSUES: LogitDistribution[] = [
  { id: 0, label: "clarity deficit", logit: 2.1, probability: 0.62, deltaFromTop: 0 },
  { id: 1, label: "feedback latency", logit: 1.2, probability: 0.21, deltaFromTop: 0.41 },
];

describe("walkthrough step mapping", () => {
  it("maps steps to stages", () => {
    expect(stepStage(0)).toBe("embeddings");
    expect(stepStage(5)).toBe("layers");
    expect(stepStage(13)).toBe("pooling");
    expect(stepStage(14)).toBe("classification");
  });

  it("maps layer steps to attention and hidden-state indices", () => {
    expect(attentionLayerIndex(0)).toBe(-1);
    expect(attentionLayerIndex(1)).toBe(0);
    expect(attentionLayerIndex(12)).toBe(11);
    expect(attentionLayerIndex(13)).toBe(-1);
    expect(attentionLayerIndex(14)).toBe(-1);

    expect(hiddenStateLayerIndex(0)).toBe(0);
    expect(hiddenStateLayerIndex(1)).toBe(1);
    expect(hiddenStateLayerIndex(12)).toBe(12);
    expect(hiddenStateLayerIndex(13)).toBe(12);
    expect(hiddenStateLayerIndex(14)).toBe(-1);
  });

  it("buckets layers into lower/middle/deep phases", () => {
    expect(phaseName(0)).toBe("Lower");
    expect(phaseName(3)).toBe("Lower");
    expect(phaseName(4)).toBe("Middle");
    expect(phaseName(7)).toBe("Middle");
    expect(phaseName(8)).toBe("Deep");
    expect(phaseName(11)).toBe("Deep");
  });

  it("clamps steps to the 0..14 boundaries", () => {
    expect(clampStep(-5)).toBe(0);
    expect(clampStep(0)).toBe(0);
    expect(clampStep(7)).toBe(7);
    expect(clampStep(TOTAL_STEPS)).toBe(TOTAL_STEPS);
    expect(clampStep(99)).toBe(TOTAL_STEPS);
  });

  it("derives the playback interval from speed", () => {
    expect(stepIntervalMs(0.5)).toBe(800);
    expect(stepIntervalMs(1)).toBe(400);
    expect(stepIntervalMs(2)).toBe(200);
  });
});

describe("computeTopMeanPairs", () => {
  it("ranks the strongest off-diagonal pairs of the mean matrix", () => {
    const internals = makeInternals();
    const pairs = computeTopMeanPairs(internals, 1, 3);
    // Mean over heads of (h*10) with h = 0..11 is 55, so the mean matrix at
    // layer 1 is 155 + i + j/10; the max off-diagonal is (i=2, j=1) = 157.1.
    expect(pairs[0].query).toBe(2);
    expect(pairs[0].key).toBe(1);
    expect(pairs[0].weight).toBeCloseTo(157.1, 4);
    expect(pairs.every((p) => p.query !== p.key)).toBe(true);
    expect(pairs.length).toBeLessThanOrEqual(3);
  });
});

describe("buildNarrative", () => {
  const internals = makeInternals();

  it("describes the embedding step", () => {
    const { caption } = buildNarrative({
      step: 0,
      internals,
      subwords: SUBWORDS,
      topKIssues: TOP_ISSUES,
    });
    expect(caption).toContain("Reading subword tokens");
  });

  it("names the real top pair at a layer step", () => {
    const { headline, caption } = buildNarrative({
      step: 7,
      internals,
      subwords: SUBWORDS,
      topKIssues: TOP_ISSUES,
    });
    expect(headline).toContain("Middle Layers (Layer 7)");
    expect(caption).toContain("Layer 7");
    expect(caption).toContain("bait");
    expect(caption).toContain("maba");
  });

  it("describes mean pooling", () => {
    const { caption } = buildNarrative({
      step: 13,
      internals,
      subwords: SUBWORDS,
      topKIssues: TOP_ISSUES,
    });
    expect(caption).toContain("Mask-Expanded Mean Pooling");
  });

  it("names the top candidate at the classification step", () => {
    const { caption } = buildNarrative({
      step: 14,
      internals,
      subwords: SUBWORDS,
      topKIssues: TOP_ISSUES,
    });
    expect(caption).toContain("clarity deficit");
  });
});

describe("EncoderWalkthroughPlayer rendering", () => {
  const noop = () => {};

  it("renders controls, progress, and the current thought at a layer step", () => {
    const markup = renderToStaticMarkup(
      <EncoderWalkthroughPlayer
        step={7}
        onStepChange={noop}
        isPlaying={false}
        onPlayChange={noop}
        speed={1}
        onSpeedChange={noop}
        internals={makeInternals()}
        subwords={SUBWORDS}
        topKIssues={TOP_ISSUES}
        issueLogitsRaw={[2.1, 1.2]}
      />,
    );
    expect(markup).toContain("Step 7/14");
    expect(markup).toContain("Layer 7");
    expect(markup).toContain("Play");
    expect(markup).toContain("Middle Layers (Layer 7)");
    expect(markup).toContain("bait");
  });

  it("marks the final step as complete and offers replay", () => {
    const markup = renderToStaticMarkup(
      <EncoderWalkthroughPlayer
        step={14}
        onStepChange={noop}
        isPlaying={false}
        onPlayChange={noop}
        speed={1}
        onSpeedChange={noop}
        internals={makeInternals()}
        subwords={SUBWORDS}
        topKIssues={TOP_ISSUES}
        issueLogitsRaw={[2.1, 1.2]}
      />,
    );
    expect(markup).toContain("Complete");
    expect(markup).toContain("Replay");
    expect(markup).toContain("clarity deficit");
  });
});
