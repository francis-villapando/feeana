import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createModel, type ModelKind, type ModelAdapter } from "../../src/lib/algorithm/models";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TestCase {
  id: string;
  text: string;
  expectedIssue: string;
}

async function loadTestSet(): Promise<TestCase[]> {
  const filePath = path.join(__dirname, "../../public/model-data/labeled-test-set.json");
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

// Simple metric calculations
function calculateF1(predictions: string[], expected: string[], uniqueIssues: string[]) {
  let macroF1 = 0;
  
  for (const issue of uniqueIssues) {
    let tp = 0, fp = 0, fn = 0;
    
    for (let i = 0; i < expected.length; i++) {
      const p = predictions[i];
      const e = expected[i];
      
      if (p === issue && e === issue) tp++;
      else if (p === issue && e !== issue) fp++;
      else if (p !== issue && e === issue) fn++;
    }
    
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * ((precision * recall) / (precision + recall)) : 0;
    
    macroF1 += f1;
  }
  
  return macroF1 / uniqueIssues.length;
}

function percentile(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

async function runBenchmark(kind: ModelKind, testSet: TestCase[]) {
  console.log(`\n======================================`);
  console.log(`Benchmarking Model: ${kind.toUpperCase()}`);
  console.log(`======================================`);

  const memBeforeLoad = process.memoryUsage().heapUsed;
  const tLoadStart = performance.now();
  
  let model: ModelAdapter;
  try {
    model = createModel(kind);
    await model.load();
  } catch (err: any) {
    console.error(`Failed to load model ${kind}:`, err.message);
    if (kind === "svm") {
      console.log("-> Make sure you ran 'python scripts/training/export_svm_pipeline.py' first.");
    }
    return;
  }
  
  const loadTimeMs = performance.now() - tLoadStart;
  const memAfterLoad = process.memoryUsage().heapUsed;
  const loadMemMb = (memAfterLoad - memBeforeLoad) / 1024 / 1024;
  
  console.log(`Load time: ${loadTimeMs.toFixed(2)} ms`);
  console.log(`Load memory footprint: ${loadMemMb.toFixed(2)} MB`);
  
  const predictions: string[] = [];
  const expected: string[] = [];
  const latencies: number[] = [];
  
  console.log(`Running inference on ${testSet.length} samples...`);
  
  for (const sample of testSet) {
    const p = await model.predict(sample.text);
    predictions.push(p.issue);
    expected.push(sample.expectedIssue);
    latencies.push(p.latencyMs);
  }
  
  const memAfterInference = process.memoryUsage().heapUsed;
  const inferenceMemMb = (memAfterInference - memAfterLoad) / 1024 / 1024;
  
  await model.dispose();
  
  // Aggregate metrics
  const uniqueIssues = Array.from(new Set(expected));
  const macroF1 = calculateF1(predictions, expected, uniqueIssues);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = percentile(latencies, 0.95);
  
  console.log(`\n--- Results for ${kind.toUpperCase()} ---`);
  console.log(`Macro F1 Score   : ${(macroF1 * 100).toFixed(2)}%`);
  console.log(`Avg Latency      : ${avgLatency.toFixed(2)} ms / entry`);
  console.log(`P95 Latency      : ${p95Latency.toFixed(2)} ms / entry`);
  console.log(`Inference Memory : ${inferenceMemMb.toFixed(2)} MB`);
}

async function main() {
  const testSet = await loadTestSet();
  const modelsToTest: ModelKind[] = ["distilxlmr", "mdeberta", "mbert", "svm"];
  
  for (const kind of modelsToTest) {
    await runBenchmark(kind, testSet);
  }
  
  console.log(`\nBenchmarking complete.`);
}

main().catch(console.error);
