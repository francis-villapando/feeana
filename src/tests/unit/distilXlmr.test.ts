import { describe, it, expect } from "vitest";
import { DistilXlmrAdapter } from "../../lib/algorithm/models/distilXlmr";
import {
  CONFIDENCE_FALLBACK_THRESHOLD,
  applyConfidenceFallback,
} from "../../lib/algorithm/models/finetuned";
import { EncodeFeedback } from "../../lib/algorithm/preprocess";

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
