import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/hooks/utils";
import { HIDDEN_SIZE, decomposeClassLogit, type ModelInternals } from "@/lib/algorithm/internals";
import type { LogitDistribution } from "@/components/dev/simulationEngine";

// Diverging scale: red = positive activation, blue = negative.
function pooledColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "rgba(120, 120, 120, 0.15)";
  const norm = Math.min(Math.abs(value) / maxAbs, 1);
  const alpha = (0.08 + norm * 0.92).toFixed(3);
  return value >= 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(59, 130, 246, ${alpha})`;
}

export function PoolingHeadInspector({
  internals,
  topKIssues,
  issueLogitsRaw,
}: {
  internals: ModelInternals;
  topKIssues: LogitDistribution[];
  issueLogitsRaw: number[];
}) {
  const { pooled, headWeights } = internals;
  const [selectedId, setSelectedId] = useState(topKIssues[0]?.id ?? 0);
  const [hoveredDim, setHoveredDim] = useState<number | null>(null);

  const maxAbs = useMemo(() => pooled.reduce((m, v) => Math.max(m, Math.abs(v)), 0), [pooled]);

  const selected = topKIssues.find((entry) => entry.id === selectedId) ?? topKIssues[0];

  const decomposition = useMemo(() => {
    if (!headWeights || selected?.id === undefined) return null;
    const weights = headWeights.issue.weights[selected.id];
    const bias = headWeights.issue.bias[selected.id];
    if (!weights || bias === undefined) return null;
    const { contributions, sum } = decomposeClassLogit(weights, bias, pooled);
    const rankedDims = Array.from(contributions)
      .map((value, dim) => ({ dim, value, weight: weights[dim] }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 10);
    let positive = 0;
    let negative = 0;
    for (const v of contributions) {
      if (v >= 0) positive += v;
      else negative += v;
    }
    return { contributions, sum, bias, rankedDims, positive, negative };
  }, [headWeights, selected, pooled]);

  const highlightDims = useMemo(
    () => new Set(decomposition?.rankedDims.map((d) => d.dim) ?? []),
    [decomposition],
  );

  const runtimeLogit = selected?.id !== undefined ? issueLogitsRaw[selected.id] : undefined;
  const residual =
    decomposition && runtimeLogit !== undefined ? decomposition.sum - runtimeLogit : undefined;

  return (
    <div className="space-y-4">
      {/* Pooled sentence vector */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Mean-pooled sentence vector ({HIDDEN_SIZE} dimensions)</Label>
          <span className="font-mono text-[10px] text-muted-foreground">
            max |v| {maxAbs.toFixed(3)}
          </span>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="flex gap-2">
            <div
              className="grid flex-1"
              style={{ gridTemplateColumns: `repeat(${HIDDEN_SIZE / 16}, minmax(0, 1fr))` }}
              onMouseLeave={() => setHoveredDim(null)}
            >
              {Array.from(pooled).map((value, dim) => (
                <div
                  key={dim}
                  title={`dim ${dim} · ${value.toFixed(4)}`}
                  onMouseEnter={() => setHoveredDim(dim)}
                  className={cn(
                    "h-3.5 border border-border/20",
                    hoveredDim === dim && "ring-1 ring-foreground",
                    highlightDims.has(dim) && "ring-1 ring-inset ring-foreground/50",
                  )}
                  style={{ backgroundColor: pooledColor(value, maxAbs) }}
                />
              ))}
            </div>
            <div className="w-px bg-border" />
            <div className="flex flex-col justify-center gap-1 font-mono text-[10px] text-muted-foreground">
              <span className="text-foreground">
                {hoveredDim !== null ? `dim ${hoveredDim}` : "dim —"}
              </span>
              <span>{hoveredDim !== null ? pooled[hoveredDim].toFixed(4) : "—"}</span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The encoder output is averaged over all active tokens (padding excluded) into this single
          384-dim vector — the only representation the classification heads ever see.
        </p>
      </div>

      {/* Logit decomposition */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Exact head projection · w·v + b</Label>
          {topKIssues.map((entry) => (
            <button
              key={entry.id ?? entry.label}
              type="button"
              onClick={() => entry.id !== undefined && setSelectedId(entry.id)}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                entry.id === selectedId
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {!headWeights ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            Head weights sidecar (head_weights.json) unavailable — the logit decomposition is
            hidden. Re-run the training export to regenerate it.
          </div>
        ) : decomposition ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <DecompStat label="Bias b_k" value={decomposition.bias} />
              <DecompStat label="Σ positive w·v" value={decomposition.positive} tone="pos" />
              <DecompStat label="Σ negative w·v" value={decomposition.negative} tone="neg" />
              <DecompStat label="Reconstructed logit" value={decomposition.sum} strong />
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  Reconstruction uses the fp32 head matrices; the int8 ONNX runtime re-quantizes
                  them.
                </span>
                <span className="font-mono">
                  runtime logit {runtimeLogit?.toFixed(5) ?? "—"} · residual{" "}
                  <span className="text-warning">{residual?.toFixed(5) ?? "—"}</span>
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Top dimensions driving this logit</Label>
              <div className="space-y-0.5">
                {decomposition.rankedDims.map((d) => {
                  const scale = Math.abs(decomposition.rankedDims[0]?.value ?? 1) || 1;
                  const pct = (Math.abs(d.value) / scale) * 100;
                  return (
                    <div key={d.dim} className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="w-14 text-right text-muted-foreground">dim {d.dim}</span>
                      <span className="w-20 text-right tabular-nums">
                        v {pooled[d.dim].toFixed(3)}
                      </span>
                      <span className="w-20 text-right tabular-nums">w {d.weight.toFixed(3)}</span>
                      <div className="flex h-2 flex-1 items-center">
                        <div className="flex h-2 w-1/2 justify-end">
                          {d.value < 0 && (
                            <div
                              className="h-2 rounded-l bg-[rgb(59,130,246)]"
                              style={{ width: `${pct}%` }}
                            />
                          )}
                        </div>
                        <div className="h-3 w-px bg-border" />
                        <div className="flex h-2 w-1/2">
                          {d.value >= 0 && (
                            <div
                              className="h-2 rounded-r bg-[rgb(239,68,68)]"
                              style={{ width: `${pct}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <span className="w-20 text-right tabular-nums">{d.value.toFixed(4)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            No decomposition available for this class.
          </div>
        )}
      </div>
    </div>
  );
}

function DecompStat({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone?: "pos" | "neg";
  strong?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-sm tabular-nums",
          strong && "font-semibold text-foreground",
          tone === "pos" && "text-[rgb(239,68,68)]",
          tone === "neg" && "text-[rgb(59,130,246)]",
        )}
      >
        {value.toFixed(4)}
      </p>
    </div>
  );
}
