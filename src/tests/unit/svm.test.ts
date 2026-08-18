import { describe, it, expect } from "vitest";
import { SvmAdapter } from "../../lib/algorithm/models/svm";

describe("SvmAdapter", () => {
  it("loads the issue/polarity sessions and label mappings", async () => {
    const adapter = new SvmAdapter();
    await adapter.load();
    expect(adapter["issueSession"]).toBeTruthy();
    expect(adapter["polaritySession"]).toBeTruthy();
    expect(adapter["labelMap"]).toBeTruthy();
    await adapter.dispose();
  });

  it("returns a well-formed Prediction for raw text", async () => {
    const adapter = new SvmAdapter();
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

  it("preserves the lowercase uncategorized label from label mappings", async () => {
    const adapter = new SvmAdapter();
    await adapter.load();
    const pred = await adapter.predict("A topic unrelated to anything discussed.");
    if (pred.issue.toLowerCase() === "uncategorized") {
      expect(pred.issue).toBe("uncategorized");
    }
    await adapter.dispose();
  });
});
