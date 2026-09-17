import { describe, it, expect } from "vitest";
import { DistilXlmrAdapter } from "../../lib/algorithm/models/distilXlmr";
import {
  CONFIDENCE_FALLBACK_THRESHOLD,
  applyConfidenceFallback,
} from "../../lib/algorithm/models/finetuned";
import { EncodeFeedback } from "../../lib/algorithm/preprocess";
import { HIDDEN_SIZE, NUM_HEADS, NUM_LAYERS } from "../../lib/algorithm/internals";

describe("DistilXlmrAdapter", { timeout: 30000 }, () => {
  it("loads the session, tokenizer, and label mappings", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    expect(adapter.session).toBeTruthy();
    expect(adapter.tokenizer).toBeTruthy();
    expect(adapter.labelMap).toBeTruthy();
    await adapter.dispose();
  });

  it("returns a well-formed Prediction for raw text", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    const pred = await adapter.predict("The professor never explains anything clearly.");
    expect(typeof pred.issue).toBe("string");
    expect(pred.issue.length).toBeGreaterThan(0);
    expect(["neg", "neu", "pos"]).toContain(pred.polarity);
    expect(pred.confidence).toBeGreaterThan(0);
    expect(pred.confidence).toBeLessThanOrEqual(1);
    expect(typeof pred.latencyMs).toBe("number");
    await adapter.dispose();
  });

  it("normalizes the uncategorized label to capitalized form", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    const pred = await adapter.predict(
      "The seatwork was manageable but the lecture part was hard.",
    );
    if (pred.issue.toLowerCase() === "uncategorized") {
      expect(pred.issue).toBe("Uncategorized");
    }
    await adapter.dispose();
  });
});

describe("confidence fallback threshold", () => {
  it("exports the calibrated 0.31 threshold", () => {
    expect(CONFIDENCE_FALLBACK_THRESHOLD).toBe(0.31);
  });

  it("routes below-threshold top confidence to Uncategorized", () => {
    expect(applyConfidenceFallback("subject alienation", 0.3)).toBe("Uncategorized");
    expect(applyConfidenceFallback("subject alienation", 0.3099)).toBe("Uncategorized");
  });

  it("retains the raw issue at or above the threshold", () => {
    expect(applyConfidenceFallback("subject alienation", 0.31)).toBe("subject alienation");
    expect(applyConfidenceFallback("subject alienation", 0.3101)).toBe("subject alienation");
  });

  it("surfaces fallback telemetry from predictEncodedDiagnostics", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    const encoding = EncodeFeedback(
      "Makes mistakes frequently and is not equipped to teach at this level.",
      adapter.tokenizer!,
    );
    const diag = await adapter.predictEncodedDiagnostics(encoding);
    expect(diag.confidenceThreshold).toBe(0.31);
    expect(typeof diag.rawIssue).toBe("string");
    expect(diag.rawConfidence).toBeCloseTo(diag.confidence, 10);
    expect(diag.routedDueToLowConfidence).toBe(diag.rawConfidence < 0.31);
    if (diag.routedDueToLowConfidence) {
      expect(diag.issue).toBe("Uncategorized");
    } else {
      expect(diag.issue).toBe(diag.rawIssue);
    }
    await adapter.dispose();
  });
});

describe("DistilXlmrAdapter encoder internals", { timeout: 60000 }, () => {
  it("exposes attention, hidden states, and the pooled vector with consistent shapes", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    const encoding = EncodeFeedback(
      "The professor never explains anything clearly and rushes the discussion.",
      adapter.tokenizer!,
    );
    const diag = await adapter.predictEncodedDiagnostics(encoding);

    const internals = diag.internals;
    expect(internals).toBeDefined();
    const { activeTokens, attention, hiddenStates, pooled } = internals;

    expect(activeTokens).toBeGreaterThan(1);
    expect(activeTokens).toBeLessThanOrEqual(encoding.inputIds.length);
    expect(attention.length).toBe(NUM_LAYERS * NUM_HEADS * activeTokens * activeTokens);
    expect(hiddenStates.length).toBe((NUM_LAYERS + 1) * activeTokens * HIDDEN_SIZE);
    expect(pooled.length).toBe(HIDDEN_SIZE);
    expect(internals.layerL2).toHaveLength(NUM_LAYERS + 1);
    expect(internals.layerCosine).toHaveLength(NUM_LAYERS);
    expect(internals.headEntropy).toHaveLength(NUM_LAYERS * NUM_HEADS);

    await adapter.dispose();
  });

  it("keeps every attention row normalized over the active tokens", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    const encoding = EncodeFeedback("Very engaging lectures.", adapter.tokenizer!);
    const diag = await adapter.predictEncodedDiagnostics(encoding);
    const { activeTokens, attention } = diag.internals;

    const matrixSize = activeTokens * activeTokens;
    for (let head = 0; head < NUM_LAYERS * NUM_HEADS; head++) {
      const base = head * matrixSize;
      for (let i = 0; i < activeTokens; i++) {
        let rowSum = 0;
        for (let j = 0; j < activeTokens; j++) rowSum += attention[base + i * activeTokens + j];
        expect(rowSum).toBeCloseTo(1, 4);
      }
    }
    await adapter.dispose();
  });

  it("mean-pools the final hidden state into the reported sentence vector", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    const encoding = EncodeFeedback(
      "The examples are clear but the pace is too fast.",
      adapter.tokenizer!,
    );
    const diag = await adapter.predictEncodedDiagnostics(encoding);
    const { activeTokens, hiddenStates, pooled } = diag.internals;

    const lastLayerBase = NUM_LAYERS * activeTokens * HIDDEN_SIZE;
    for (let d = 0; d < HIDDEN_SIZE; d++) {
      let sum = 0;
      for (let t = 0; t < activeTokens; t++) {
        sum += hiddenStates[lastLayerBase + t * HIDDEN_SIZE + d];
      }
      expect(pooled[d]).toBeCloseTo(sum / activeTokens, 4);
    }
    await adapter.dispose();
  });

  it("loads the fp32 head matrices and tags ranked classes with their id", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    const encoding = EncodeFeedback("Poorly organized lectures.", adapter.tokenizer!);
    const diag = await adapter.predictEncodedDiagnostics(encoding);

    for (const entry of diag.topKIssues) {
      expect(typeof entry.id).toBe("number");
      expect(entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.id).toBeLessThan(diag.issueLogitsRaw.length);
    }

    const classCount = diag.issueLogitsRaw.length;
    const headWeights = diag.internals.headWeights;
    expect(headWeights).toBeDefined();
    expect(headWeights!.issue.weights).toHaveLength(classCount);
    expect(headWeights!.issue.bias).toHaveLength(classCount);
    expect(headWeights!.issue.weights[0]).toHaveLength(HIDDEN_SIZE);
    expect(headWeights!.polarity.weights).toHaveLength(3);
    expect(headWeights!.polarity.bias).toHaveLength(3);
    expect(headWeights!.polarity.weights[0]).toHaveLength(HIDDEN_SIZE);

    await adapter.dispose();
  });
});
