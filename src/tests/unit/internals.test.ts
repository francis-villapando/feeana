import { describe, expect, it } from "vitest";
import {
  HIDDEN_SIZE,
  NUM_HEADS,
  NUM_LAYERS,
  activeTokenCount,
  buildModelInternals,
  decomposeClassLogit,
  getAttentionMatrix,
  getHiddenStateLayer,
  getMeanAttentionMatrix,
  headAttentionEntropy,
  layerCosineDrift,
  layerL2Norms,
  sliceAttentions,
  sliceHiddenStates,
  topAttentionPairs,
  type ModelInternals,
} from "../../lib/algorithm/internals";

describe("activeTokenCount", () => {
  it("counts the leading non-padding tokens", () => {
    expect(activeTokenCount([1, 1, 1, 0, 0])).toBe(3);
    expect(activeTokenCount([1, 0, 0, 0])).toBe(1);
  });

  it("handles empty and all-padding masks", () => {
    expect(activeTokenCount([])).toBe(0);
    expect(activeTokenCount([0, 0, 0])).toBe(0);
  });
});

describe("sliceAttentions", () => {
  const layers = 2;
  const heads = 2;
  const seqLen = 4;
  const active = 2;

  // value(l, h, i, j) = l*100 + h*10 + i + j/10
  const raw = new Float32Array(layers * heads * seqLen * seqLen);
  for (let l = 0; l < layers; l++) {
    for (let h = 0; h < heads; h++) {
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          raw[(l * heads + h) * seqLen * seqLen + i * seqLen + j] = l * 100 + h * 10 + i + j / 10;
        }
      }
    }
  }

  it("extracts the active-token block for every layer and head", () => {
    const out = sliceAttentions(raw, seqLen, active, layers, heads);
    expect(out.length).toBe(layers * heads * active * active);
    for (let l = 0; l < layers; l++) {
      for (let h = 0; h < heads; h++) {
        for (let i = 0; i < active; i++) {
          for (let j = 0; j < active; j++) {
            expect(out[(l * heads + h) * active * active + i * active + j]).toBeCloseTo(
              l * 100 + h * 10 + i + j / 10,
              5,
            );
          }
        }
      }
    }
  });
});

describe("sliceHiddenStates", () => {
  it("extracts the active-token hidden states for every layer", () => {
    const layers = 2;
    const seqLen = 4;
    const hidden = 3;
    const active = 2;
    const raw = new Float32Array(layers * seqLen * hidden);
    for (let l = 0; l < layers; l++) {
      for (let t = 0; t < seqLen; t++) {
        for (let d = 0; d < hidden; d++) {
          raw[l * seqLen * hidden + t * hidden + d] = l * 1000 + t * 10 + d;
        }
      }
    }
    const out = sliceHiddenStates(raw, seqLen, active, layers, hidden);
    expect(out.length).toBe(layers * active * hidden);
    for (let l = 0; l < layers; l++) {
      for (let t = 0; t < active; t++) {
        for (let d = 0; d < hidden; d++) {
          expect(out[(l * active + t) * hidden + d]).toBeCloseTo(l * 1000 + t * 10 + d, 5);
        }
      }
    }
  });
});

describe("layerL2Norms", () => {
  it("averages the squared hidden state across tokens and dimensions", () => {
    const layers = 2;
    const active = 2;
    const hidden = 3;
    const hidden_states = new Float32Array(layers * active * hidden).fill(2);
    const norms = layerL2Norms(hidden_states, active, layers, hidden);
    expect(norms).toEqual([2, 2]);
  });
});

describe("layerCosineDrift", () => {
  it("returns 1 when a layer is unchanged and -1 when it is negated", () => {
    const active = 1;
    const hidden = 3;
    const hidden_states = new Float32Array([
      1,
      2,
      3, // layer 0
      1,
      2,
      3, // layer 1 (identical)
      -1,
      -2,
      -3, // layer 2 (negated)
    ]);
    const drift = layerCosineDrift(hidden_states, active, 3, hidden);
    expect(drift[0]).toBeCloseTo(1, 6);
    expect(drift[1]).toBeCloseTo(-1, 6);
  });
});

describe("headAttentionEntropy", () => {
  it("returns ln(N) for a uniform row and 0 for a peaked row", () => {
    const active = 2;
    // Layer 0 head 0 uniform, layer 0 head 1 peaked.
    const attention = new Float32Array([0.5, 0.5, 0.5, 0.5, 1.0, 0.0, 1.0, 0.0]);
    const entropy = headAttentionEntropy(attention, active, 1, 2);
    expect(entropy[0]).toBeCloseTo(Math.LN2, 6);
    expect(entropy[1]).toBeCloseTo(0, 6);
  });
});

describe("decomposeClassLogit", () => {
  it("sums the per-dimension products plus the bias exactly", () => {
    const { contributions, sum } = decomposeClassLogit([1, 2, 3], 0.5, [1, 1, 1]);
    expect(Array.from(contributions)).toEqual([1, 2, 3]);
    expect(sum).toBeCloseTo(6.5, 6);
  });

  it("truncates to the shorter of weights and pooled dimensions", () => {
    const { contributions } = decomposeClassLogit([1, 2, 3], 0, [1, 1]);
    expect(contributions.length).toBe(2);
  });
});

describe("attention accessors", () => {
  // The accessors index using the module-level head count, so the synthetic
  // tensor must use the same [NUM_LAYERS, NUM_HEADS, N, N] layout.
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

  const internals: ModelInternals = {
    activeTokens,
    attention,
    hiddenStates: new Float32Array((NUM_LAYERS + 1) * activeTokens * HIDDEN_SIZE),
    pooled: new Float32Array(HIDDEN_SIZE),
    layerL2: new Array(NUM_LAYERS + 1).fill(0),
    layerCosine: new Array(NUM_LAYERS).fill(1),
    headEntropy: new Array(NUM_LAYERS * NUM_HEADS).fill(0),
  };

  it("extracts one layer/head matrix", () => {
    const matrix = getAttentionMatrix(internals, 1, 1);
    const expected = [110.0, 110.1, 110.2, 111.0, 111.1, 111.2, 112.0, 112.1, 112.2];
    expect(matrix.length).toBe(expected.length);
    expected.forEach((value, idx) => expect(matrix[idx]).toBeCloseTo(value, 5));
  });

  it("averages all heads of a layer", () => {
    const mean = getMeanAttentionMatrix(internals, 0);
    // Mean over heads of (h * 10) with h = 0..11 ⇒ 55 at (i = 0, j = 0).
    expect(mean[0]).toBeCloseTo(55, 6);
  });

  it("ranks the strongest off-diagonal pairs", () => {
    const pairs = topAttentionPairs(internals, 1, 1, 3);
    expect(pairs[0].query).toBe(2);
    expect(pairs[0].key).toBe(1);
    expect(pairs[0].weight).toBeCloseTo(112.1, 5);
    expect(pairs.every((p) => p.query !== p.key)).toBe(true);
  });
});

describe("buildModelInternals", () => {
  it("assembles sliced activations and telemetry from raw outputs", () => {
    const layers = 12;
    const heads = 12;
    const seqLen = 4;
    const active = 2;
    const rawAttention = new Float32Array(layers * heads * seqLen * seqLen).fill(0.5);
    const rawHidden = new Float32Array((layers + 1) * seqLen * 384).fill(1);
    const rawPooled = new Float32Array(384).fill(0.25);
    const internals = buildModelInternals(
      {
        attentions: rawAttention,
        hiddenStates: rawHidden,
        pooled: rawPooled,
        attentionMask: [1, 1, 0, 0],
        seqLen,
      },
      { issue: { weights: [], bias: [] }, polarity: { weights: [], bias: [] } },
    );

    expect(internals.activeTokens).toBe(2);
    expect(internals.attention.length).toBe(layers * heads * active * active);
    expect(internals.hiddenStates.length).toBe((layers + 1) * active * 384);
    expect(internals.pooled.length).toBe(384);
    expect(internals.layerL2).toHaveLength(13);
    expect(internals.layerCosine).toHaveLength(12);
    expect(internals.headEntropy).toHaveLength(144);
    // Uniform attention rows over 2 tokens ⇒ ln(2) entropy for every head.
    expect(internals.headEntropy[0]).toBeCloseTo(Math.LN2, 6);
    expect(internals.headWeights).toBeDefined();
  });
});

describe("getHiddenStateLayer", () => {
  it("slices the correct layer block", () => {
    const activeTokens = 2;
    const hiddenStates = new Float32Array(2 * activeTokens * 384);
    hiddenStates.fill(7, 1 * activeTokens * 384);
    const internals: ModelInternals = {
      activeTokens,
      attention: new Float32Array(0),
      hiddenStates,
      pooled: new Float32Array(384),
      layerL2: [0, 0],
      layerCosine: [1],
      headEntropy: [],
    };
    const layer1 = getHiddenStateLayer(internals, 1);
    expect(layer1.every((v) => v === 7)).toBe(true);
  });
});
