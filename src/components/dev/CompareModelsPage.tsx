import { useState, useEffect } from "react";
import { useModelBenchmark, type TestCase, type ModelBenchmarkResult } from "./ModelBenchmarkRunner";

async function loadTestSet(): Promise<TestCase[]> {
  const res = await fetch("/model-data/labeled-test-set.json");
  if (!res.ok) throw new Error("Failed to load test set");
  return res.json();
}

function formatMB(mb: number): string {
  return mb > 0 ? `${mb.toFixed(2)} MB` : "N/A";
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

function formatPct(pct: number): string {
  return `${(pct * 100).toFixed(2)}%`;
}

export function CompareModelsPage() {
  const [testSet, setTestSet] = useState<TestCase[]>([]);
  const { results, loading, currentModel, progress, runAll } = useModelBenchmark();

  useEffect(() => {
    loadTestSet().then(setTestSet).catch(console.error);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Model Comparison Benchmark</h1>
        <button
          onClick={() => runAll(testSet)}
          disabled={loading || testSet.length === 0}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
        >
          {loading ? `Running: ${currentModel}...` : "Run All Benchmarks"}
        </button>
      </div>

      {progress.stage && (
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex justify-between text-sm mb-1">
            <span>{progress.stage}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Aggregate Results</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 font-medium">Model</th>
                  <th className="p-3 font-medium">Macro F1</th>
                  <th className="p-3 font-medium">Macro Precision</th>
                  <th className="p-3 font-medium">Macro Recall</th>
                  <th className="p-3 font-medium">Avg Latency</th>
                  <th className="p-3 font-medium">P50 Latency</th>
                  <th className="p-3 font-medium">P95 Latency</th>
                  <th className="p-3 font-medium">Load Time</th>
                  <th className="p-3 font-medium">Load Memory</th>
                  <th className="p-3 font-medium">Inference Memory</th>
                  <th className="p-3 font-medium">Residual Memory</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.modelName} className="border-b border-border/50">
                    <td className="p-3 font-mono font-medium">{r.modelName.toUpperCase()}</td>
                    <td className="p-3">{formatPct(r.macroF1)}</td>
                    <td className="p-3">{formatPct(r.macroPrecision)}</td>
                    <td className="p-3">{formatPct(r.macroRecall)}</td>
                    <td className="p-3">{formatMs(r.avgLatencyMs)}</td>
                    <td className="p-3">{formatMs(r.p50LatencyMs)}</td>
                    <td className="p-3">{formatMs(r.p95LatencyMs)}</td>
                    <td className="p-3">{formatMs(r.loadTimeMs)}</td>
                    <td className="p-3">{formatMB(r.loadMemoryMB)}</td>
                    <td className="p-3">{formatMB(r.inferenceMemoryMB)}</td>
                    <td className="p-3">{formatMB(r.residualMemoryMB)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-semibold mt-8">Per-Sample Predictions</h2>
          {results.map((r) => (
            <details key={r.modelName} className="group">
              <summary className="cursor-pointer p-3 bg-muted rounded-lg font-medium">
                {r.modelName.toUpperCase()} — {r.predictions.length} samples
              </summary>
              <div className="p-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="p-2 font-medium">Sample ID</th>
                      <th className="p-2 font-medium">Predicted</th>
                      <th className="p-2 font-medium">Expected</th>
                      <th className="p-2 font-medium">Correct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.predictions.map((p) => (
                      <tr key={p.sampleId} className="border-b border-border/50">
                        <td className="p-2 font-mono">{p.sampleId}</td>
                        <td className="p-2">{p.predicted}</td>
                        <td className="p-2">{p.expected}</td>
                        <td className="p-2 text-center">
                          <span className={p.correct ? "text-green-500" : "text-red-500"}>
                            {p.correct ? "✓" : "✗"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}

      {testSet.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          Loading test set...
        </div>
      )}
    </div>
  );
}