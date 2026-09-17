import { useEffect, useMemo } from "react";
import {
  CheckCircle2,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  StepForward,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  HIDDEN_SIZE,
  NUM_LAYERS,
  getHiddenStateLayer,
  type ModelInternals,
} from "@/lib/algorithm/internals";
import type { LogitDistribution } from "@/components/dev/simulationEngine";
import {
  TOTAL_STEPS,
  attentionLayerIndex,
  buildNarrative,
  clampStep,
  computeTopMeanPairs,
  hiddenStateLayerIndex,
  stepIntervalMs,
  stepStage,
  type WalkthroughStage,
} from "./walkthrough";

function shortToken(token: string): string {
  return token.replace(/^▁/, "").replace(/^Ġ/, "") || token;
}

// Diverging scale shared by the vector strips: red = positive, blue = negative.
function vectorColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "rgba(120, 120, 120, 0.15)";
  const norm = Math.min(Math.abs(value) / maxAbs, 1);
  const alpha = (0.08 + norm * 0.92).toFixed(3);
  return value >= 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(59, 130, 246, ${alpha})`;
}

export function EncoderWalkthroughPlayer({
  step,
  onStepChange,
  isPlaying,
  onPlayChange,
  speed,
  onSpeedChange,
  internals,
  subwords,
  topKIssues,
  issueLogitsRaw,
}: {
  step: number;
  onStepChange: (step: number) => void;
  isPlaying: boolean;
  onPlayChange: (playing: boolean) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  internals: ModelInternals;
  subwords: string[];
  topKIssues: LogitDistribution[];
  issueLogitsRaw: number[];
}) {
  // Automated progression: one step per interval while playing; the final step
  // stops playback instead of advancing past the classification head.
  useEffect(() => {
    if (!isPlaying) return;
    if (step >= TOTAL_STEPS) {
      onPlayChange(false);
      return;
    }
    const timer = setTimeout(() => onStepChange(step + 1), stepIntervalMs(speed));
    return () => clearTimeout(timer);
  }, [isPlaying, step, speed, onStepChange, onPlayChange]);

  const stage = stepStage(step);
  const layerIdx = attentionLayerIndex(step);
  const hiddenIdx = hiddenStateLayerIndex(step);
  const narrative = buildNarrative({ step, internals, subwords, topKIssues });
  const tokens = subwords.slice(0, internals.activeTokens);
  const topPair = layerIdx >= 0 ? computeTopMeanPairs(internals, layerIdx, 1)[0] : undefined;
  const completed = step >= TOTAL_STEPS;

  const perTokenNorms = useMemo(() => {
    if (hiddenIdx < 0) return [];
    const layer = getHiddenStateLayer(internals, hiddenIdx);
    const norms: number[] = [];
    for (let t = 0; t < internals.activeTokens; t++) {
      let sumSq = 0;
      for (let d = 0; d < HIDDEN_SIZE; d++) {
        const v = layer[t * HIDDEN_SIZE + d];
        sumSq += v * v;
      }
      norms.push(Math.sqrt(sumSq));
    }
    return norms;
  }, [internals, hiddenIdx]);

  const togglePlay = () => {
    if (isPlaying) {
      onPlayChange(false);
      return;
    }
    if (step >= TOTAL_STEPS) onStepChange(0);
    onPlayChange(true);
  };

  const stageLabel =
    stage === "embeddings"
      ? "Input & Embeddings"
      : stage === "layers"
        ? `Layer ${step}`
        : stage === "pooling"
          ? "Mean Pooling"
          : "Classification";

  return (
    <div className="space-y-3">
      {/* Transport controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying ? "Pause" : completed ? "Replay" : "Play"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStepChange(clampStep(step - 1))}
          disabled={step <= 0}
          aria-label="Previous step"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStepChange(clampStep(step + 1))}
          disabled={step >= TOTAL_STEPS}
          aria-label="Next step"
        >
          <StepForward className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onPlayChange(false);
            onStepChange(0);
          }}
          aria-label="Reset playback"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Select value={String(speed)} onValueChange={(v) => onSpeedChange(Number(v))}>
          <SelectTrigger className="h-8 w-24 text-xs" aria-label="Playback speed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.5" className="text-xs">
              0.5x
            </SelectItem>
            <SelectItem value="1" className="text-xs">
              1x
            </SelectItem>
            <SelectItem value="2" className="text-xs">
              2x
            </SelectItem>
          </SelectContent>
        </Select>
        {completed && (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Complete
          </Badge>
        )}
      </div>

      {/* Scrubber + step readout */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: TOTAL_STEPS + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i}`}
              onClick={() => onStepChange(i)}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                i === step
                  ? "bg-primary"
                  : i < step
                    ? "bg-primary/50"
                    : "bg-muted-foreground/25 hover:bg-muted-foreground/50",
              )}
            />
          ))}
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          Step {step}/{TOTAL_STEPS} · {stageLabel}
        </span>
      </div>

      {/* Current thought banner */}
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
              {narrative.headline}
            </p>
            <p className="mt-0.5 text-sm">{narrative.caption}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {stage === "layers" ? (
          <AttentionSpotlight tokens={tokens} pair={topPair} />
        ) : (
          <TokenContextPanel tokens={tokens} perTokenNorms={perTokenNorms} />
        )}
        <RepresentationPanel
          stage={stage}
          step={step}
          internals={internals}
          tokens={tokens}
          perTokenNorms={perTokenNorms}
          topKIssues={topKIssues}
          issueLogitsRaw={issueLogitsRaw}
        />
      </div>
    </div>
  );
}

function AttentionSpotlight({
  tokens,
  pair,
}: {
  tokens: string[];
  pair?: { query: number; key: number; weight: number };
}) {
  const n = tokens.length;
  const x1 = n > 1 ? ((pair?.query ?? 0) + 0.5) * (100 / n) : 50;
  const x2 = n > 1 ? ((pair?.key ?? 0) + 0.5) * (100 / n) : 50;
  const weight = pair?.weight ?? 0;

  return (
    <div className="space-y-1.5">
      <Label>Active layer attention spotlight</Label>
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-1">
          {tokens.map((tok, i) => {
            const isSpecial = tok === "<s>" || tok === "</s>";
            return (
              <span
                key={i}
                title={`#${i} ${tok}`}
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[11px]",
                  isSpecial && "text-muted-foreground",
                  pair && i === pair.query && "ring-1 ring-primary",
                  pair && i === pair.key && "bg-primary/15 font-semibold",
                )}
              >
                {shortToken(tok)}
              </span>
            );
          })}
        </div>
        {pair && (
          <svg
            className="mt-1 h-10 w-full"
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={`M ${x1} 34 Q 50 4 ${x2} 34`}
              fill="none"
              stroke="rgb(99, 102, 241)"
              strokeWidth={1 + weight * 3}
              strokeOpacity={0.25 + weight * 0.6}
              vectorEffect="non-scaling-stroke"
            >
              <animate
                attributeName="stroke-opacity"
                values="0.2;0.8;0.2"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        )}
      </div>
      {pair && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {shortToken(tokens[pair.query] ?? `#${pair.query}`)} →{" "}
          {shortToken(tokens[pair.key] ?? `#${pair.key}`)} · weight {pair.weight.toFixed(3)}
        </p>
      )}
    </div>
  );
}

function RepresentationPanel({
  stage,
  step,
  internals,
  tokens,
  perTokenNorms,
  topKIssues,
  issueLogitsRaw,
}: {
  stage: WalkthroughStage;
  step: number;
  internals: ModelInternals;
  tokens: string[];
  perTokenNorms: number[];
  topKIssues: LogitDistribution[];
  issueLogitsRaw: number[];
}) {
  if (stage === "classification") {
    const top = topKIssues[0];
    const rawLogit = top?.id !== undefined ? issueLogitsRaw[top.id] : undefined;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Top-5 issue probabilities (softmax)</Label>
          {rawLogit !== undefined && (
            <span className="font-mono text-[10px] text-muted-foreground">
              top raw logit {rawLogit.toFixed(3)}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {topKIssues.map((entry, i) => (
            <div key={entry.label} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                {i + 1}
              </span>
              <span className="w-36 shrink-0 truncate text-[11px] font-medium">{entry.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${Math.max(entry.probability * 100, 1)}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-[10px]">
                {(entry.probability * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stage === "pooling") {
    return (
      <VectorStrip
        values={internals.pooled}
        label={`Mean-pooled sentence vector (${HIDDEN_SIZE} dims)`}
        note={`‖v‖₂ ${internals.layerL2[NUM_LAYERS]?.toFixed(3) ?? "—"}`}
      />
    );
  }

  if (stage === "embeddings") {
    return (
      <VectorStrip
        values={getHiddenStateLayer(internals, 0)}
        label={`Layer 0 embeddings (${HIDDEN_SIZE} dims)`}
        note={`mean ‖h‖₂ ${internals.layerL2[0]?.toFixed(3) ?? "—"}`}
      />
    );
  }

  const hiddenIdx = hiddenStateLayerIndex(step);
  const norm = hiddenIdx >= 0 ? internals.layerL2[hiddenIdx] : undefined;
  const drift = hiddenIdx >= 1 ? internals.layerCosine[hiddenIdx - 1] : undefined;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          Layer {step} ‖h‖₂ {norm?.toFixed(3) ?? "—"}
        </Badge>
        {drift !== undefined && (
          <Badge variant="outline" className="font-mono">
            drift vs L{hiddenIdx - 1} {drift.toFixed(3)}
          </Badge>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Per-token representation magnitude</Label>
        <TokenMagnitudeBars tokens={tokens} perTokenNorms={perTokenNorms} />
      </div>
    </div>
  );
}

function TokenContextPanel({
  tokens,
  perTokenNorms,
}: {
  tokens: string[];
  perTokenNorms: number[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>Input token context</Label>
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-1">
          {tokens.map((tok, i) => {
            const isSpecial = tok === "<s>" || tok === "</s>";
            return (
              <span
                key={i}
                title={`#${i} ${tok}`}
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[11px]",
                  isSpecial && "text-muted-foreground",
                )}
              >
                {shortToken(tok)}
              </span>
            );
          })}
        </div>
        {perTokenNorms.length > 0 && (
          <div className="mt-3 space-y-1">
            <Label className="text-[11px]">Per-token embedding magnitude</Label>
            <TokenMagnitudeBars tokens={tokens} perTokenNorms={perTokenNorms} />
          </div>
        )}
      </div>
    </div>
  );
}

function TokenMagnitudeBars({
  tokens,
  perTokenNorms,
}: {
  tokens: string[];
  perTokenNorms: number[];
}) {
  const maxNorm = perTokenNorms.reduce((m, v) => Math.max(m, v), 0) || 1e-6;
  return (
    <div className="flex items-end gap-1">
      {perTokenNorms.map((normValue, t) => (
        <div key={t} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <div className="flex h-16 w-full items-end rounded-sm bg-muted/40">
            <div
              className="w-full rounded-sm bg-[rgb(99,102,241)]"
              style={{ height: `${(normValue / maxNorm) * 100}%` }}
            />
          </div>
          <span
            className="max-w-full truncate font-mono text-[9px] text-muted-foreground"
            title={tokens[t]}
          >
            {shortToken(tokens[t] ?? `#${t}`)}
          </span>
        </div>
      ))}
    </div>
  );
}

function VectorStrip({
  values,
  label,
  note,
}: {
  values: ArrayLike<number>;
  label: string;
  note?: string;
}) {
  const maxAbs = useMemo(
    () => Array.from(values).reduce((m, v) => Math.max(m, Math.abs(v)), 0),
    [values],
  );
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px]">{label}</Label>
        <span className="font-mono text-[10px] text-muted-foreground">
          {note ? `${note} · ` : ""}max |v| {maxAbs.toFixed(3)}
        </span>
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${HIDDEN_SIZE / 16}, minmax(0, 1fr))` }}
      >
        {Array.from(values).map((value, dim) => (
          <div
            key={dim}
            title={`dim ${dim} · ${value.toFixed(4)}`}
            className="h-2 border border-border/20"
            style={{ backgroundColor: vectorColor(value, maxAbs) }}
          />
        ))}
      </div>
    </div>
  );
}
