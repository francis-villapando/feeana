import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DistilXlmrAdapter } from "../../lib/algorithm/models/distilXlmr";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LATENCY_BUDGET_MS = 2000;
const WARMUP_RUNS = 3;

interface LongSample {
  id: string;
  text: string;
  expectedIssue: string;
}

function loadLongSamples(): LongSample[] {
  const filePath = path.join(__dirname, "../../../scripts/training/data/benchmark-500.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as LongSample[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

describe("DistilXlmrAdapter per-entry latency on ~500-char samples", () => {
  it("processes each 500-char sample in under 2 seconds", async () => {
    const samples = loadLongSamples();
    expect(samples.length).toBeGreaterThan(0);

    const model = new DistilXlmrAdapter();
    await model.load();

    for (let i = 0; i < WARMUP_RUNS; i++) {
      await model.predict(samples[0].text);
    }

    const rows: { id: string; chars: number; latencyMs: number }[] = [];
    for (const sample of samples) {
      const { latencyMs } = await model.predict(sample.text);
      rows.push({ id: sample.id, chars: sample.text.length, latencyMs });
      expect(
        latencyMs,
        `${sample.id} (${sample.text.length} chars) took ${latencyMs.toFixed(1)}ms — exceeds ${LATENCY_BUDGET_MS}ms budget`,
      ).toBeLessThan(LATENCY_BUDGET_MS);
    }

    console.log(rows);

    const sorted = [...rows].map((r) => r.latencyMs).sort((a, b) => a - b);
    const avgMs = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const maxMs = sorted[sorted.length - 1];
    const lines = rows.map(
      (r) =>
        `  ${r.id.padEnd(8)} ${String(r.chars).padStart(3)} chars  ${r.latencyMs.toFixed(1)} ms`,
    );
    process.stdout.write(
      `[latency] per-entry times on ${rows.length} ~500-char samples:\n` +
        `${lines.join("\n")}\n` +
        `[latency] avg=${avgMs.toFixed(1)}ms p95=${percentile(sorted, 0.95).toFixed(1)}ms max=${maxMs.toFixed(1)}ms budget=${LATENCY_BUDGET_MS}ms\n`,
    );

    await model.dispose();
  }, 300_000);
});
