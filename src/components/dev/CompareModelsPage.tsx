import { useState, useEffect } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import {
  useModelComparison,
  loadTestSet,
  MODEL_KINDS,
  type TestCase,
  type ModelComparisonResult,
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

type MetricRow = {
  label: string;
  key?: keyof ModelComparisonResult;
  format?: (v: number) => string;
  getValue?: (kind: (typeof MODEL_KINDS)[number]) => string;
};

const METRICS: MetricRow[] = [
  {
    label: "Model Size",
    getValue: (kind) => formatBytesMB(MODEL_SIZES_BYTES[kind]),
  },
  { label: "Cold Start (ms)", key: "coldStartMs", format: formatMs },
  { label: "Cold Peak JS Heap (MB)", key: "coldPeakJSHeapMB", format: formatMB },
  { label: "Warm Start (ms)", key: "warmStartMs", format: formatMs },
  { label: "Avg Latency (ms)", key: "avgLatencyMs", format: formatMs },
  { label: "P50 Latency (ms)", key: "p50LatencyMs", format: formatMs },
  { label: "P95 Latency (ms)", key: "p95LatencyMs", format: formatMs },
  { label: "Peak JS Heap (MB)", key: "peakJSHeapMB", format: formatMB },
];

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
    try {
      await runComparison(testSet);
    } catch (err) {
      console.error("[CompareModelsPage] Comparison failed:", err);
      alert(`Comparison failed: ${err instanceof Error ? err.message : String(err)}`);
    }
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

  const renderMetricCell = (
    kind: (typeof MODEL_KINDS)[number],
    metric: MetricRow,
  ) => {
    if (metric.getValue) {
      return (
        <TableCell key={kind} className="px-4 py-3 text-muted-foreground whitespace-nowrap">
          {metric.getValue(kind)}
        </TableCell>
      );
    }

    const result = resultsByModel.get(kind);
    const value = metric.key ? (result?.[metric.key] as number | undefined) : undefined;

    if (value !== undefined && metric.format) {
      return (
        <TableCell key={kind} className="px-4 py-3 whitespace-nowrap">
          {metric.format(value)}
        </TableCell>
      );
    }

    if (loading && currentModel === kind) {
      return (
        <TableCell key={kind} className="px-4 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Pending…
          </span>
        </TableCell>
      );
    }

    return (
      <TableCell key={kind} className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        —
      </TableCell>
    );
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
                  <TableHead className="px-4 whitespace-nowrap">Metric</TableHead>
                  {MODEL_KINDS.map((kind) => (
                    <TableHead key={kind} className="px-4 whitespace-nowrap">
                      {MODEL_LABELS[kind]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {METRICS.map((metric) => (
                  <TableRow key={metric.label}>
                    <TableCell className="px-4 py-3 font-medium whitespace-nowrap">
                      {metric.label}
                    </TableCell>
                    {MODEL_KINDS.map((kind) => renderMetricCell(kind, metric))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
