import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useModelBenchmark, loadTestSet, type TestCase } from "./ModelBenchmarkRunner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  if (testSet.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        <p className="ml-2 text-muted-foreground">Loading test set…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Model Comparison Benchmark</h1>
          <Button onClick={() => runAll(testSet)} disabled={loading}>
            {loading ? `Running: ${currentModel}…` : "Run All Benchmarks"}
          </Button>
        </div>

        {progress.stage && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress.stage}
                </span>
                <span className="font-medium text-muted-foreground">
                  Model {progress.modelIndex} of {progress.modelCount}
                </span>
              </div>
              {progress.total > 0 && (
                <div className="text-xs text-muted-foreground">
                  {progress.current} / {progress.total}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Aggregate Results</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Macro F1</TableHead>
                      <TableHead>Macro Precision</TableHead>
                      <TableHead>Macro Recall</TableHead>
                      <TableHead>Avg Latency</TableHead>
                      <TableHead>P50 Latency</TableHead>
                      <TableHead>P95 Latency</TableHead>
                      <TableHead>Cold Start (ms)</TableHead>
                      <TableHead>Peak JS Heap (MB)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.modelName}>
                        <TableCell className="font-mono font-medium">
                          {r.modelName.toUpperCase()}
                        </TableCell>
                        <TableCell>{formatPct(r.macroF1)}</TableCell>
                        <TableCell>{formatPct(r.macroPrecision)}</TableCell>
                        <TableCell>{formatPct(r.macroRecall)}</TableCell>
                        <TableCell>{formatMs(r.avgLatencyMs)}</TableCell>
                        <TableCell>{formatMs(r.p50LatencyMs)}</TableCell>
                        <TableCell>{formatMs(r.p95LatencyMs)}</TableCell>
                        <TableCell>{formatMs(r.coldStartMs)}</TableCell>
                        <TableCell>{formatMB(r.peakJSHeapMB)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Per-Sample Predictions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {results.map((r) => (
                  <details key={r.modelName}>
                    <summary className="cursor-pointer p-3 font-medium">
                      {r.modelName.toUpperCase()} — {r.predictions.length} samples
                    </summary>
                    <div className="overflow-x-auto p-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sample ID</TableHead>
                            <TableHead>Predicted</TableHead>
                            <TableHead>Expected</TableHead>
                            <TableHead>Correct</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {r.predictions.map((p) => (
                            <TableRow key={p.sampleId}>
                              <TableCell className="font-mono">{p.sampleId}</TableCell>
                              <TableCell>{p.predicted}</TableCell>
                              <TableCell>{p.expected}</TableCell>
                              <TableCell>
                                <span className={p.correct ? "text-green-500" : "text-red-500"}>
                                  {p.correct ? "✓" : "✗"}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
