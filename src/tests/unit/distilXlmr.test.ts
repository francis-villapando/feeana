import { describe, it, expect } from "vitest";
import { DistilXlmrAdapter } from "../../lib/algorithm/models/distilXlmr";

describe("DistilXlmrAdapter", () => {
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
