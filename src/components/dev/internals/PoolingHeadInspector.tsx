import { useMemo, useState } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/hooks/utils";
import { HIDDEN_SIZE, decomposeClassLogit, type ModelInternals } from "@/lib/algorithm/internals";
import type { LogitDistribution } from "@/components/dev/simulationEngine";
import { vectorColor } from "./walkthrough";

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
  const [isMathOpen, setIsMathOpen] = useState(false);

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

    // Running total plus the undisplayed remainder, so the visible rows close the
    // sum to the reconstructed logit instead of leaving a silent gap.
    const topDims = new Set(rankedDims.map((d) => d.dim));
    let running = 0;
    const rows = rankedDims.map((d) => {
      running += d.value;
      return { ...d, running };
    });
    let restSum = 0;
    for (let dim = 0; dim < contributions.length; dim++) {
      if (!topDims.has(dim)) restSum += contributions[dim];
    }
    return {
      rows,
      sum,
      bias,
      restSum,
      restCount: contributions.length - rows.length,
      // Bar lengths are relative to the strongest term in the table.
      scale: Math.abs(rows[0]?.value ?? 1) || 1,
    };
  }, [headWeights, selected, pooled]);

  const highlightDims = useMemo(
    () => new Set(decomposition?.rows.map((d) => d.dim) ?? []),
    [decomposition],
  );

  const runtimeLogit = selected?.id !== undefined ? issueLogitsRaw[selected.id] : undefined;
  const residual =
    decomposition && runtimeLogit !== undefined ? decomposition.sum - runtimeLogit : undefined;
  const relativeResidual =
    residual !== undefined && runtimeLogit ? Math.abs(residual / runtimeLogit) : undefined;

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
                  style={{ backgroundColor: vectorColor(value, maxAbs) }}
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
        <p className="text-[11px] text-muted-foreground">
          Outlined cells mark the dimensions that drive the selected class logit; the arithmetic
          inspector below breaks them out.
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
          <div className="rounded-md border border-border bg-muted/20">
            <button
              type="button"
              onClick={() => setIsMathOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-xs font-semibold">Logit Arithmetic Inspector</span>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    v → w·v → Σ + b → z_k
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {isMathOpen ? "Hide Math" : "Inspect Step-by-Step Math"}
                </Badge>
                {isMathOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
            </button>

            {isMathOpen && (
              <div className="space-y-3 border-t border-border/60 p-3 text-xs">
                <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
                  <div className="font-mono">
                    <span className="font-semibold text-primary">
                      z_k = b_k + Σ<sub>d=1..{HIDDEN_SIZE}</sub> w<sub>k,d</sub> · v<sub>d</sub>
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    The logit is a plain dot product of one class weight row with the pooled vector,
                    plus that class&apos;s bias. Summing the visible terms reproduces it exactly.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="min-w-full border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/60 text-muted-foreground">
                        <th className="p-2 text-left font-medium">Term</th>
                        <th className="p-2 text-right font-medium">v_d</th>
                        <th className="p-2 text-right font-medium">w_k,d</th>
                        <th className="p-2 text-right font-medium">w_k,d · v_d</th>
                        <th className="p-2 text-right font-medium">running Σ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {decomposition.rows.map((d) => {
                        const pct = (Math.abs(d.value) / decomposition.scale) * 100;
                        return (
                          <tr key={d.dim}>
                            <td className="p-2 font-sans">dim {d.dim}</td>
                            <td className="p-2 text-right tabular-nums">
                              {pooled[d.dim].toFixed(3)}
                            </td>
                            <td className="p-2 text-right tabular-nums">{d.weight.toFixed(3)}</td>
                            <td className="p-2 text-right">
                              <span className="flex items-center justify-end gap-1.5">
                                <SignedBar value={d.value} pct={pct} />
                                <span className="w-14 text-right tabular-nums">
                                  {d.value.toFixed(4)}
                                </span>
                              </span>
                            </td>
                            <td className="p-2 text-right tabular-nums text-muted-foreground">
                              {d.running.toFixed(4)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td className="p-2 font-sans text-muted-foreground">
                          Remaining {decomposition.restCount} dims (combined)
                        </td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right tabular-nums">
                          {decomposition.restSum.toFixed(4)}
                        </td>
                        <td className="p-2 text-right tabular-nums font-semibold">
                          {(decomposition.sum - decomposition.bias).toFixed(4)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border/80 bg-muted/40 font-semibold">
                        <td className="p-2 font-sans">Bias b_k</td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right tabular-nums text-primary">
                          + {decomposition.bias.toFixed(4)}
                        </td>
                      </tr>
                      <tr className="border-t border-border/80 bg-primary/5 font-semibold">
                        <td className="p-2 font-sans text-primary">z_k = b_k + Σ_d w_k,d · v_d</td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right tabular-nums text-primary">
                          {decomposition.sum.toFixed(4)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-3 text-[11px]">
                  <span className="text-muted-foreground">
                    Reconstruction uses the fp32 head matrices; the int8 ONNX runtime re-quantizes
                    them. The relative residual bounds reconstruction error only — the driving
                    dimensions are not re-derived from dequantized heads, so this does not by itself
                    validate the attribution.
                  </span>
                  <span className="font-mono">
                    int8 runtime z_k {runtimeLogit?.toFixed(5) ?? "—"} · residual{" "}
                    <span className="text-warning">{residual?.toFixed(5) ?? "—"}</span> · |residual|
                    /|z_k| {relativeResidual === undefined ? "—" : relativeResidual.toFixed(5)}
                  </span>
                </div>
              </div>
            )}
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

function SignedBar({ value, pct }: { value: number; pct: number }) {
  return (
    <span className="relative flex h-2 w-14 items-center">
      <span className="absolute inset-x-0 h-px bg-border" />
      {value >= 0 ? (
        <span
          className="h-2 rounded-r-sm bg-emerald-500/70"
          style={{ width: `${Math.max(pct, 1)}%`, marginLeft: "50%" }}
        />
      ) : (
        <span
          className="h-2 rounded-l-sm bg-destructive/70"
          style={{ width: `${Math.max(pct, 1)}%`, marginRight: "50%" }}
        />
      )}
    </span>
  );
}
