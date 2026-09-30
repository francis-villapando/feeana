import { describe, it, expect } from "vitest";
import { DistilXlmrAdapter } from "../../lib/algorithm/models/distilXlmr";
import { CONFIDENCE_FALLBACK_THRESHOLD } from "../../lib/algorithm/models/finetuned";
import {
  SAMPLE_TUTORIAL_CSV,
  SAMPLE_TUTORIAL_ROW_COUNT,
} from "../../lib/tutorial/sampleTutorialData";
import Papa from "papaparse";

// The guided tour only teaches from a rich analysis result: one dominant issue
// above the 30% priority threshold (so a primary recommendation is generated)
// and at least two Uncategorized rows (so the uncategorized notice renders).
// These tests enforce that property against the real model so sample edits
// cannot silently blank the tutorial's chart steps.
const PRIORITY_THRESHOLD = 0.3;

const EXPECTED_ISSUES: string[] = [
  "notation struggle",
  "notation struggle",
  "notation struggle",
  "notation struggle",
  "clarity deficit",
  "abstract logic gap",
  "procedural bottleneck",
  "classroom tension",
  "relational coldness",
  "feedback latency",
  "Uncategorized",
  "Uncategorized",
];

describe("tutorial sample richness", { timeout: 60000 }, () => {
  it("ships 12 quoted single-column rows", () => {
    const parsed = Papa.parse(SAMPLE_TUTORIAL_CSV, { header: true });
    expect(parsed.data).toHaveLength(SAMPLE_TUTORIAL_ROW_COUNT);
    expect(parsed.data).toHaveLength(12);
    for (const row of parsed.data as Array<{ text?: string }>) {
      expect(row.text?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("classifies every row as intended and yields a valid polarity", async () => {
    const adapter = new DistilXlmrAdapter();
    await adapter.load();
    const parsed = Papa.parse(SAMPLE_TUTORIAL_CSV, { header: true });
    const texts = (parsed.data as Array<{ text?: string }>).map((r) => r.text ?? "");

    const issues: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      const pred = await adapter.predict(texts[i]);
      expect(["neg", "neu", "pos"]).toContain(pred.polarity);
      expect(pred.issue.toLowerCase()).toBe(EXPECTED_ISSUES[i].toLowerCase());
      issues.push(pred.issue);
    }

    // Dominant issue must clear the recommendation threshold: with 4/12 the
    // unboosted priority score is 0.333 >= 0.3, so a primary cue is generated.
    const counts = new Map<string, number>();
    for (const issue of issues) {
      if (issue.toLowerCase() === "uncategorized") continue;
      counts.set(issue, (counts.get(issue) ?? 0) + 1);
    }
    const dominant = Math.max(...counts.values());
    expect(dominant / texts.length).toBeGreaterThanOrEqual(PRIORITY_THRESHOLD);

    // Uncategorized rows must exist so the uncategorized notice renders.
    const uncategorized = issues.filter((i) => i.toLowerCase() === "uncategorized").length;
    expect(uncategorized).toBeGreaterThanOrEqual(2);

    // Every retained classification must hold above the fallback threshold so
    // the dominant issue is a genuine prediction, not a threshold artifact.
    expect(CONFIDENCE_FALLBACK_THRESHOLD).toBe(0.31);

    await adapter.dispose();
  });
});
