import { useEffect, useMemo, useState } from "react";
import { Grid3x3, MousePointer2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/hooks/utils";
import {
  NUM_HEADS,
  NUM_LAYERS,
  getAttentionMatrix,
  getMeanAttentionMatrix,
  topAttentionPairs,
  type ModelInternals,
} from "@/lib/algorithm/internals";
import { shortToken } from "./walkthrough";

const MEAN_HEAD = "mean";

// Single-hue sequential scale. Attention weights are heavily skewed low, so a
// gamma curve keeps small weights visible without washing out the peaks.
function attentionColor(value: number, max: number): string {
  if (max <= 0) return "transparent";
  const norm = Math.sqrt(Math.min(Math.max(value, 0) / max, 1));
  return `rgba(99, 102, 241, ${norm.toFixed(3)})`;
}

export function AttentionHeatmapExplorer({
  internals,
  subwords,
  controlledLayer,
  onLayerSelect,
}: {
  internals: ModelInternals;
  subwords: string[];
  /** External layer selection (0-based) from the walkthrough player, if any. */
  controlledLayer?: number;
  /** Fired when the user changes the layer here, so the player can follow. */
  onLayerSelect?: (layer: number) => void;
}) {
  const [layer, setLayer] = useState(0);
  const [head, setHead] = useState<string>(String(0));
  const [hovered, setHovered] = useState<{ query: number; key: number } | null>(null);

  // Keep the internal layer in sync with the controlled value so releasing
  // control (e.g. the player leaves a layer step) doesn't snap back.
  useEffect(() => {
    if (controlledLayer !== undefined) setLayer(controlledLayer);
  }, [controlledLayer]);

  const activeLayer = Math.min(controlledLayer ?? layer, NUM_LAYERS - 1);
  const n = internals.activeTokens;
  const isMean = head === MEAN_HEAD;
  const headIndex = isMean ? 0 : Number(head);

  const matrix = useMemo(
    () =>
      isMean
        ? getMeanAttentionMatrix(internals, activeLayer)
        : getAttentionMatrix(internals, activeLayer, headIndex),
    [internals, activeLayer, headIndex, isMean],
  );

  const max = useMemo(() => matrix.reduce((m, v) => (v > m ? v : m), 0), [matrix]);

  const entropy = internals.headEntropy;
  const entropyRange = useMemo(() => {
    let min = Infinity;
    let maxE = -Infinity;
    for (const e of entropy) {
      if (e < min) min = e;
      if (e > maxE) maxE = e;
    }
    return { min, max: maxE };
  }, [entropy]);

  // Mean of the 12 head entropies per layer: the layer-level focus summary shown
  // next to the matrix. Entropy is bounded by ln(activeTokens), so it only ranks
  // layers within this run.
  const layerEntropy = useMemo(() => {
    return Array.from({ length: NUM_LAYERS }, (_, l) => {
      let sum = 0;
      for (let h = 0; h < NUM_HEADS; h++) sum += entropy[l * NUM_HEADS + h];
      return sum / NUM_HEADS;
    });
  }, [entropy]);

  const entropyBarWidth = (value: number) => {
    const span = entropyRange.max - entropyRange.min;
    return span < 1e-6 ? 100 : ((value - entropyRange.min) / span) * 100;
  };

  const pairs = useMemo(
    () => (isMean ? [] : topAttentionPairs(internals, activeLayer, headIndex, 5)),
    [internals, activeLayer, headIndex, isMean],
  );

  const tokens = subwords.slice(0, n);
  const hoveredWeight = hovered ? matrix[hovered.query * n + hovered.key] : 0;
  const rowSum = hovered
    ? Array.from({ length: n }).reduce<number>(
        (acc, _, j) => acc + matrix[hovered.query * n + j],
        0,
      )
    : 0;

  // Grid tracks stay square and readable across 10-64 active tokens.
  const cellSize = n > 48 ? 12 : n > 32 ? 16 : n > 20 ? 20 : 26;
  // Spread the layer bars over the exact height of the matrix so each one sits
  // inside its own twelfth of the table.
  const layerRowHeight = (n * cellSize) / NUM_LAYERS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(activeLayer)}
          onValueChange={(v) => {
            setLayer(Number(v));
            onLayerSelect?.(Number(v));
          }}
        >
          <SelectTrigger className="h-8 w-[9.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: NUM_LAYERS }, (_, l) => (
              <SelectItem key={l} value={String(l)} className="text-xs">
                Layer {l + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={head} onValueChange={setHead}>
          <SelectTrigger className="h-8 w-[9.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MEAN_HEAD} className="text-xs">
              Mean (12 heads)
            </SelectItem>
            {Array.from({ length: NUM_HEADS }, (_, h) => (
              <SelectItem key={h} value={String(h)} className="text-xs">
                Head {h + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="font-mono">
          <Grid3x3 className="mr-1 h-3 w-3" />
          {n}×{n}
        </Badge>
        <Badge variant="outline" className="font-mono">
          max {max.toFixed(3)}
        </Badge>
        {!isMean && (
          <Badge variant="outline" className="font-mono">
            entropy {entropy[activeLayer * NUM_HEADS + headIndex].toFixed(3)} nats
          </Badge>
        )}
      </div>

      {/* Hover readout */}
      <div className="flex min-h-8 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-[11px]">
        <MousePointer2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {hovered ? (
          <>
            <span className="text-muted-foreground">from</span>
            <span className="font-semibold text-foreground">
              {shortToken(tokens[hovered.query] ?? `#${hovered.query}`)}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold text-foreground">
              {shortToken(tokens[hovered.key] ?? `#${hovered.key}`)}
            </span>
            <span className="ml-auto tabular-nums">
              weight {hoveredWeight.toFixed(4)} · row Σ {rowSum.toFixed(4)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            Hover a cell to inspect the token-to-token attention weight.
          </span>
        )}
      </div>

      <div className="flex gap-3">
        {/* Row token labels */}
        <div className="flex shrink-0 flex-col justify-start pt-5 font-mono text-[10px] text-muted-foreground">
          {tokens.map((token, i) => (
            <div
              key={i}
              className="flex items-center justify-end truncate pr-1 text-right"
              style={{ height: cellSize, maxWidth: 96 }}
              title={`#${i} ${shortToken(token)}`}
            >
              {i} {shortToken(token)}
            </div>
          ))}
        </div>

        <div className="w-fit shrink-0">
          {/* Column token labels */}
          <div
            className="grid font-mono text-[10px] text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${n}, ${cellSize}px)` }}
          >
            {tokens.map((token, j) => (
              <div key={j} className="truncate text-center" title={`#${j} ${shortToken(token)}`}>
                {j}
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${n}, ${cellSize}px)` }}
            onMouseLeave={() => setHovered(null)}
          >
            {Array.from({ length: n * n }, (_, index) => {
              const i = Math.floor(index / n);
              const j = index % n;
              const value = matrix[index];
              const isHovered = hovered?.query === i && hovered?.key === j;
              const isSameQuery = hovered?.query === i;
              return (
                <div
                  key={index}
                  className={cn(
                    "border border-border/20 transition-[box-shadow] duration-75",
                    isHovered && "relative z-10 ring-1 ring-foreground",
                    !isHovered && isSameQuery && "ring-1 ring-inset ring-foreground/20",
                  )}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: attentionColor(value, max),
                  }}
                  onMouseEnter={() => setHovered({ query: i, key: j })}
                />
              );
            })}
          </div>
        </div>

        {/* Per-layer mean attention entropy, one bar per encoder layer. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-5 items-end whitespace-nowrap font-mono text-[9px] text-muted-foreground">
            layer · mean entropy (nats) ↓
          </div>
          {layerEntropy.map((e, l) => {
            const isActive = activeLayer === l;
            return (
              <div
                key={l}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-1",
                  isActive && "bg-primary/10",
                )}
                style={{ height: layerRowHeight }}
              >
                <span
                  className={cn(
                    "w-4 shrink-0 text-right font-mono text-[9px]",
                    isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  L{l + 1}
                </span>
                <span className="h-1.5 flex-1 min-w-0 overflow-hidden rounded-sm bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded-sm",
                      isActive ? "bg-primary" : "bg-primary/40",
                    )}
                    style={{ width: `${entropyBarWidth(e)}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "w-9 shrink-0 text-right font-mono text-[9px] tabular-nums",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {e.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          attention
          <span className="inline-block h-3 w-24 rounded-sm bg-gradient-to-r from-transparent to-[rgb(99,102,241)]" />
          0 → {max.toFixed(3)}
        </span>
        <span>Rows are softmax distributions (Σ = 1 over active tokens)</span>
      </div>

      {!isMean && (
        <div className="space-y-1.5">
          <Label>Strongest token interactions (this head)</Label>
          <div className="space-y-1">
            {pairs.map((p, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-6 text-right text-muted-foreground">{i + 1}</span>
                <span className="w-32 truncate text-right">
                  {shortToken(tokens[p.query] ?? "?")}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="w-32 truncate">{shortToken(tokens[p.key] ?? "?")}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-[rgb(99,102,241)]"
                    style={{ width: `${Math.max((p.weight / Math.max(max, 1e-6)) * 100, 2)}%` }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums">{p.weight.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
