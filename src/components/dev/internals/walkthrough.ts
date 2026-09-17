// Pure, dependency-free helpers for the slow-motion encoder walkthrough. Kept
// free of React so the step/narrative logic is unit-testable in Node, mirroring
// internals.ts. Step s in 1..12 maps to "Layer s" (attention index s-1,
// hidden-state index s); step 0 is the embedding layer, 13 is mean pooling,
// 14 is the classification head.

import { getMeanAttentionMatrix, type ModelInternals } from "@/lib/algorithm/internals";
import type { LogitDistribution } from "@/components/dev/simulationEngine";

export const TOTAL_STEPS = 14;

export type WalkthroughStage = "embeddings" | "layers" | "pooling" | "classification";

export function stepStage(step: number): WalkthroughStage {
  if (step <= 0) return "embeddings";
  if (step <= 12) return "layers";
  if (step === 13) return "pooling";
  return "classification";
}

/** 0-based attention layer for a step, or -1 for non-layer steps. */
export function attentionLayerIndex(step: number): number {
  return step >= 1 && step <= 12 ? step - 1 : -1;
}

/** 0-based hidden-state layer for a step, or -1 for the classification step. */
export function hiddenStateLayerIndex(step: number): number {
  if (step <= 0) return 0;
  if (step <= 12) return step;
  if (step === 13) return 12;
  return -1;
}

export function phaseName(attentionLayer: number): string {
  if (attentionLayer <= 3) return "Lower";
  if (attentionLayer <= 7) return "Middle";
  return "Deep";
}

/** Playback interval per step: 0.5x = 800ms, 1x = 400ms, 2x = 200ms. */
export function stepIntervalMs(speed: number): number {
  return 400 / speed;
}

export function clampStep(step: number): number {
  return Math.max(0, Math.min(TOTAL_STEPS, Math.round(step)));
}

export interface AttentionPair {
  query: number;
  key: number;
  weight: number;
}

/** Strongest off-diagonal pairs of the layer's mean attention matrix. */
export function computeTopMeanPairs(
  internals: ModelInternals,
  layer: number,
  limit = 5,
): AttentionPair[] {
  const n = internals.activeTokens;
  const matrix = getMeanAttentionMatrix(internals, layer);
  const pairs: AttentionPair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      pairs.push({ query: i, key: j, weight: matrix[i * n + j] });
    }
  }
  return pairs.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

export interface WalkthroughNarrative {
  headline: string;
  caption: string;
}

export function buildNarrative({
  step,
  internals,
  subwords,
  topKIssues,
}: {
  step: number;
  internals: ModelInternals;
  subwords: string[];
  topKIssues: LogitDistribution[];
}): WalkthroughNarrative {
  const stage = stepStage(step);
  if (stage === "embeddings") {
    return {
      headline: "Input & Embeddings (L0)",
      caption: "Reading subword tokens and initializing 384-dimensional lexical embeddings.",
    };
  }
  if (stage === "layers") {
    const layerIdx = attentionLayerIndex(step);
    const pair = computeTopMeanPairs(internals, layerIdx, 1)[0];
    const tokens = subwords.slice(0, internals.activeTokens);
    const query = pair ? shortToken(tokens[pair.query] ?? `#${pair.query}`) : "—";
    const key = pair ? shortToken(tokens[pair.key] ?? `#${pair.key}`) : "—";
    const weight = pair ? pair.weight : 0;
    const phase = phaseName(layerIdx);
    return {
      headline: `${phase} Layers (Layer ${step})`,
      caption: `${phase} Layers (Layer ${step}): attention resolves onto '${key}' from '${query}' (weight = ${weight.toFixed(3)}).`,
    };
  }
  if (stage === "pooling") {
    return {
      headline: "Mean Pooling",
      caption:
        "Mask-Expanded Mean Pooling: blending active token states into a single sentence summary vector.",
    };
  }
  const top = topKIssues[0];
  return {
    headline: "Linear Projection & Softmax",
    caption: `Classification Heads: projecting the sentence vector onto 15 issue categories → top candidate '${top?.label ?? "—"}' selected.`,
  };
}

function shortToken(token: string): string {
  return token.replace(/^▁/, "").replace(/^Ġ/, "") || token;
}
