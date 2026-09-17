// Internal computation telemetry for the DistilXLM-R encoder.
//
// Pure, dependency-free helpers that turn the raw full-output ONNX tensors
// (attention, hidden states, pooled vector) into a compact payload the UI can
// render. Kept free of ORT/transformers imports so the Web Worker and the
// Node.js fallback share one implementation and unit tests can exercise the
// math without loading the model.

export const NUM_LAYERS = 12;
export const NUM_HEADS = 12;
export const HIDDEN_SIZE = 384;

// Head matrices shipped as a sidecar (see scripts/training/export_model_onnx.py).
export interface HeadWeightMatrices {
  issue: { weights: number[][]; bias: number[] };
  polarity: { weights: number[][]; bias: number[] };
}

// Compact, structured-clone-safe payload sent across the worker boundary.
// Bulk activations are flat Float32Arrays; per-layer telemetry is small.
export interface ModelInternals {
  /** Active (non-padding) token count, including <s>/</s>. */
  activeTokens: number;
  /** Attention over active tokens: flat [NUM_LAYERS, NUM_HEADS, N, N]. */
  attention: Float32Array;
  /** Hidden states over active tokens: flat [NUM_LAYERS + 1, N, HIDDEN_SIZE]. */
  hiddenStates: Float32Array;
  /** Mean-pooled sentence vector: [HIDDEN_SIZE]. */
  pooled: Float32Array;
  /** Mean L2 norm of each hidden state (layer 0 embeddings … layer 12). */
  layerL2: number[];
  /** Cosine similarity between consecutive layer outputs (layer l-1 vs l). */
  layerCosine: number[];
  /** Mean attention entropy per layer/head: flat [NUM_LAYERS, NUM_HEADS]. */
  headEntropy: number[];
  /** Dual-head linear matrices for the exact W·v + b logit decomposition. */
  headWeights?: HeadWeightMatrices;
}

export interface RawInternalOutputs {
  /** Flat [NUM_LAYERS, 1, NUM_HEADS, seqLen, seqLen] attention tensor. */
  attentions: Float32Array;
  /** Flat [NUM_LAYERS + 1, 1, seqLen, HIDDEN_SIZE] hidden-state tensor. */
  hiddenStates: Float32Array;
  /** Flat [1, HIDDEN_SIZE] pooled tensor. */
  pooled: Float32Array;
  /** Token mask used to derive the active-token count. */
  attentionMask: ArrayLike<number | bigint>;
  /** Padded sequence length the tensors were produced with. */
  seqLen: number;
}

/** Number of leading non-padding tokens, including <s>/</s>. */
export function activeTokenCount(attentionMask: ArrayLike<number | bigint>): number {
  let active = 0;
  for (let i = 0; i < attentionMask.length; i++) {
    if (Number(attentionMask[i]) === 1) active = i + 1;
  }
  return active;
}

/**
 * Copies the [N, N] attention block for every layer/head out of the padded
 * [L, 1, H, S, S] tensor, yielding a flat [L, H, N, N] array.
 */
export function sliceAttentions(
  raw: Float32Array,
  seqLen: number,
  active: number,
  layers: number = NUM_LAYERS,
  heads: number = NUM_HEADS,
): Float32Array {
  const out = new Float32Array(layers * heads * active * active);
  for (let l = 0; l < layers; l++) {
    for (let h = 0; h < heads; h++) {
      const srcBase = (l * heads + h) * seqLen * seqLen;
      const dstBase = (l * heads + h) * active * active;
      for (let i = 0; i < active; i++) {
        const srcRow = srcBase + i * seqLen;
        const dstRow = dstBase + i * active;
        for (let j = 0; j < active; j++) {
          out[dstRow + j] = raw[srcRow + j];
        }
      }
    }
  }
  return out;
}

/**
 * Copies the active-token hidden states out of the padded [L+1, 1, S, D]
 * tensor, yielding a flat [L+1, N, D] array.
 */
export function sliceHiddenStates(
  raw: Float32Array,
  seqLen: number,
  active: number,
  layers: number = NUM_LAYERS + 1,
  hidden: number = HIDDEN_SIZE,
): Float32Array {
  const out = new Float32Array(layers * active * hidden);
  for (let l = 0; l < layers; l++) {
    const srcBase = l * seqLen * hidden;
    const dstBase = l * active * hidden;
    for (let t = 0; t < active; t++) {
      const srcOff = srcBase + t * hidden;
      const dstOff = dstBase + t * hidden;
      for (let d = 0; d < hidden; d++) {
        out[dstOff + d] = raw[srcOff + d];
      }
    }
  }
  return out;
}

/** Mean L2 norm of each layer's active-token hidden state. */
export function layerL2Norms(
  hidden: Float32Array,
  active: number,
  layers: number = NUM_LAYERS + 1,
  hiddenSize: number = HIDDEN_SIZE,
): number[] {
  const norms: number[] = [];
  const perLayer = active * hiddenSize;
  for (let l = 0; l < layers; l++) {
    const base = l * perLayer;
    let sumSq = 0;
    for (let i = 0; i < perLayer; i++) {
      const v = hidden[base + i];
      sumSq += v * v;
    }
    norms.push(Math.sqrt(sumSq / perLayer));
  }
  return norms;
}

/**
 * Mean cosine similarity between each layer and its predecessor, averaged over
 * active tokens. Length is `layers - 1`; values near 1 mean the representation
 * barely moved between layers.
 */
export function layerCosineDrift(
  hidden: Float32Array,
  active: number,
  layers: number = NUM_LAYERS + 1,
  hiddenSize: number = HIDDEN_SIZE,
): number[] {
  const drift: number[] = [];
  for (let l = 1; l < layers; l++) {
    const prevBase = (l - 1) * active * hiddenSize;
    const currBase = l * active * hiddenSize;
    let total = 0;
    for (let t = 0; t < active; t++) {
      const prevOff = prevBase + t * hiddenSize;
      const currOff = currBase + t * hiddenSize;
      let dot = 0;
      let prevNorm = 0;
      let currNorm = 0;
      for (let d = 0; d < hiddenSize; d++) {
        const p = hidden[prevOff + d];
        const c = hidden[currOff + d];
        dot += p * c;
        prevNorm += p * p;
        currNorm += c * c;
      }
      const denom = Math.sqrt(prevNorm) * Math.sqrt(currNorm);
      if (denom > 0) total += dot / denom;
    }
    drift.push(active > 0 ? total / active : 0);
  }
  return drift;
}

/**
 * Mean Shannon entropy (nats) of each attention row, per layer/head. Rows are
 * already softmax-normalised by the model, so they sum to 1 over active tokens.
 * Low entropy marks a sharply focused (specialised) head.
 */
export function headAttentionEntropy(
  attention: Float32Array,
  active: number,
  layers: number = NUM_LAYERS,
  heads: number = NUM_HEADS,
): number[] {
  const entropy: number[] = [];
  const matrixSize = active * active;
  for (let l = 0; l < layers; l++) {
    for (let h = 0; h < heads; h++) {
      const base = (l * heads + h) * matrixSize;
      let total = 0;
      for (let i = 0; i < active; i++) {
        const row = base + i * active;
        let rowEntropy = 0;
        for (let j = 0; j < active; j++) {
          const p = attention[row + j];
          if (p > 0) rowEntropy -= p * Math.log(p);
        }
        total += rowEntropy;
      }
      entropy.push(active > 0 ? total / active : 0);
    }
  }
  return entropy;
}

/** Assembles the compact internals payload from the raw ONNX outputs. */
export function buildModelInternals(
  raw: RawInternalOutputs,
  headWeights?: HeadWeightMatrices,
): ModelInternals {
  const active = activeTokenCount(raw.attentionMask);
  const attention = sliceAttentions(raw.attentions, raw.seqLen, active);
  const hiddenStates = sliceHiddenStates(raw.hiddenStates, raw.seqLen, active);
  return {
    activeTokens: active,
    attention,
    hiddenStates,
    pooled: raw.pooled,
    layerL2: layerL2Norms(hiddenStates, active),
    layerCosine: layerCosineDrift(hiddenStates, active),
    headEntropy: headAttentionEntropy(attention, active),
    headWeights,
  };
}

/**
 * Exact per-dimension decomposition of one class logit: returns each
 * `w_d * v_d` term and their sum plus the class bias. For the same weights the
 * sum equals the pre-quantization head logit, so callers can show the
 * reconstruction and its distance from the int8 runtime logit.
 */
export function decomposeClassLogit(
  weights: number[],
  bias: number,
  pooled: ArrayLike<number>,
): { contributions: Float32Array; sum: number } {
  const dims = Math.min(weights.length, pooled.length);
  const contributions = new Float32Array(dims);
  let sum = bias;
  for (let d = 0; d < dims; d++) {
    const term = weights[d] * pooled[d];
    contributions[d] = term;
    sum += term;
  }
  return { contributions, sum };
}

/** Returns a copy of the [active, active] attention matrix for one layer/head. */
export function getAttentionMatrix(
  internals: ModelInternals,
  layer: number,
  head: number,
): Float32Array {
  const n = internals.activeTokens;
  const matrixSize = n * n;
  const base = (layer * NUM_HEADS + head) * matrixSize;
  return internals.attention.slice(base, base + matrixSize);
}

/** Mean [active, active] attention matrix across all heads of a layer. */
export function getMeanAttentionMatrix(internals: ModelInternals, layer: number): Float32Array {
  const n = internals.activeTokens;
  const matrixSize = n * n;
  const mean = new Float32Array(matrixSize);
  for (let h = 0; h < NUM_HEADS; h++) {
    const base = (layer * NUM_HEADS + h) * matrixSize;
    for (let i = 0; i < matrixSize; i++) mean[i] += internals.attention[base + i];
  }
  for (let i = 0; i < matrixSize; i++) mean[i] /= NUM_HEADS;
  return mean;
}

/** Returns a copy of the [active, HIDDEN_SIZE] hidden state for one layer. */
export function getHiddenStateLayer(internals: ModelInternals, layer: number): Float32Array {
  const layerSize = internals.activeTokens * HIDDEN_SIZE;
  const base = layer * layerSize;
  return internals.hiddenStates.slice(base, base + layerSize);
}

/** L2 norm of a single token's representation at every layer (length L+1). */
export function tokenLayerL2Norms(internals: ModelInternals, token: number): number[] {
  const { hiddenStates, activeTokens } = internals;
  const norms: number[] = [];
  for (let l = 0; l <= NUM_LAYERS; l++) {
    const base = (l * activeTokens + token) * HIDDEN_SIZE;
    let sumSq = 0;
    for (let d = 0; d < HIDDEN_SIZE; d++) {
      const v = hiddenStates[base + d];
      sumSq += v * v;
    }
    norms.push(Math.sqrt(sumSq));
  }
  return norms;
}

/**
 * Highest-attention (query, key) token pairs for one layer/head, above the
 * diagonal, sorted by weight. Used to name the strongest token interactions.
 */
export function topAttentionPairs(
  internals: ModelInternals,
  layer: number,
  head: number,
  limit = 5,
): Array<{ query: number; key: number; weight: number }> {
  const n = internals.activeTokens;
  const matrixSize = n * n;
  const base = (layer * NUM_HEADS + head) * matrixSize;
  const pairs: Array<{ query: number; key: number; weight: number }> = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      pairs.push({ query: i, key: j, weight: internals.attention[base + i * n + j] });
    }
  }
  return pairs.sort((a, b) => b.weight - a.weight).slice(0, limit);
}
