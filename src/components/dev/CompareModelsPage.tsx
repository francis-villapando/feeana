import { useState, useEffect } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import {
  useModelComparison,
  loadTestSet,
  MODEL_KINDS,
  type TestCase,
} from "./ModelComparisonRunner";
import { MODEL_SIZES_BYTES } from "@/lib/algorithm/models/sizes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const MODEL_LABELS: Record<(typeof MODEL_KINDS)[number], string> = {
  distilxlmr: "DistilXLMR",
  mbert: "mBERT",
  svm: "SVM",
};

function formatBytesMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CompareModelsPage() {
  const [testSet, setTestSet] = useState<TestCase[]>([]);
  const { results, loading, currentModel, progress, runComparison, cancel } = useModelComparison();

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

  const done = results.length === MODEL_KINDS.length;

  const handleRun = async () => {
    await runComparison(testSet);
  };

  const handleCancel = () => {
    void cancel();
  };

  let mainLabel: string;
  let mainAction: () => void;
  if (loading) {
    mainLabel = "Cancel";
    mainAction = handleCancel;
  } else if (done) {
    mainLabel = "Rerun comparison";
    mainAction = handleRun;
  } else {
    mainLabel = "Run comparison";
    mainAction = handleRun;
  }

  const resultsByModel = new Map(results.map((r) => [r.modelName, r]));

  const renderCell = (
    kind: (typeof MODEL_KINDS)[number],
    value: number | undefined,
    format: (v: number) => string,
  ) => {
    if (value !== undefined) {
      return <TableCell className="px-4 py-3 whitespace-nowrap">{format(value)}</TableCell>;
    }
    if (loading && currentModel === kind) {
      return (
        <TableCell className="px-4 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Pending…
          </span>
        </TableCell>
      );
    }
    return <TableCell className="px-4 py-3 text-muted-foreground whitespace-nowrap">—</TableCell>;
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Model comparison</h1>
            <p className="text-sm text-muted-foreground">
              Latency measured in-browser via onnxruntime-web (WASM).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={mainAction}>
              {loading ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {mainLabel}
                </>
              ) : (
                mainLabel
              )}
            </Button>
          </div>
        </div>

        {loading && progress.stage && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress.stage}
                </span>
                {progress.bytes && progress.bytes.total > 0 && (
                  <span className="font-medium text-muted-foreground">
                    {formatBytesMB(progress.bytes.loaded)} / {formatBytesMB(progress.bytes.total)}
                  </span>
                )}
                {!progress.bytes && progress.total > 0 && (
                  <span className="font-medium text-muted-foreground">
                    {progress.current} / {progress.total}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 whitespace-nowrap">Model</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Model Size</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Cold Start (ms)</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Cold Peak JS Heap (MB)</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Warm Start (ms)</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Avg Latency (ms)</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">P50 Latency (ms)</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">P95 Latency (ms)</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Peak JS Heap (MB)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODEL_KINDS.map((kind) => {
                  const r = resultsByModel.get(kind);
                  return (
                    <TableRow key={kind}>
                      <TableCell className="px-4 py-3 font-medium whitespace-nowrap">
                        {MODEL_LABELS[kind]}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatBytesMB(MODEL_SIZES_BYTES[kind])}
                      </TableCell>
                      {renderCell(kind, r?.coldStartMs, formatMs)}
                      {renderCell(kind, r?.coldPeakJSHeapMB, formatMB)}
                      {renderCell(kind, r?.warmStartMs, formatMs)}
                      {renderCell(kind, r?.avgLatencyMs, formatMs)}
                      {renderCell(kind, r?.p50LatencyMs, formatMs)}
                      {renderCell(kind, r?.p95LatencyMs, formatMs)}
                      {renderCell(kind, r?.peakJSHeapMB, formatMB)}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
