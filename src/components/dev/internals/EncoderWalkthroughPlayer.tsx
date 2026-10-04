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
  getHiddenStateLayer,
  layerMeanVector,
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
  shortToken,
  stepIntervalMs,
  stepStage,
  vectorColor,
  type WalkthroughStage,
} from "./walkthrough";

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

  // Steps 0-12 each resolve to one hidden-state layer, summarised as its mean
  // over active tokens. Step 13 renders internals.pooled instead.
  const layerMean = useMemo(
    () => (hiddenIdx >= 0 ? layerMeanVector(internals, hiddenIdx) : null),
    [internals, hiddenIdx],
  );

  const pooledNorm = useMemo(
    () => Math.sqrt(Array.from(internals.pooled).reduce((sum, v) => sum + v * v, 0)),
    [internals.pooled],
  );

  const normLabel =
    hiddenIdx < 0
      ? "Per-token magnitude"
      : hiddenIdx === 0
        ? "Per-token embedding magnitude"
        : `Per-token layer ${hiddenIdx} magnitude`;

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

      <div className="space-y-3">
        {stage === "classification" && (
          <TokenContextPanel
            tokens={tokens}
            perTokenNorms={perTokenNorms}
            magnitudeLabel={normLabel}
          />
        )}
        <RepresentationPanel
          stage={stage}
          step={step}
          internals={internals}
          tokens={tokens}
          perTokenNorms={perTokenNorms}
          layerMean={layerMean}
          pooledNorm={pooledNorm}
          attentionPair={topPair}
          topKIssues={topKIssues}
          issueLogitsRaw={issueLogitsRaw}
        />
      </div>
    </div>
  );
}

function RepresentationPanel({
  stage,
  step,
  internals,
  tokens,
  perTokenNorms,
  layerMean,
  pooledNorm,
  attentionPair,
  topKIssues,
  issueLogitsRaw,
}: {
  stage: WalkthroughStage;
  step: number;
  internals: ModelInternals;
  tokens: string[];
  perTokenNorms: number[];
  layerMean: Float32Array | null;
  pooledNorm: number;
  attentionPair?: { query: number; key: number; weight: number };
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
        note={`‖v‖₂ ${pooledNorm.toFixed(3)} · = token mean of layer 12`}
      />
    );
  }

  const hiddenIdx = hiddenStateLayerIndex(step);
  const rms = hiddenIdx >= 0 ? internals.layerRms[hiddenIdx] : undefined;
  const drift = hiddenIdx >= 1 ? internals.layerCosine[hiddenIdx - 1] : undefined;

  return (
    <div className="space-y-1.5">
      {attentionPair && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-[11px]">Per-token representation magnitude</Label>
            <Badge variant="outline" className="font-mono">
              Layer {step} element RMS {rms?.toFixed(3) ?? "—"}
            </Badge>
            {drift !== undefined && (
              <Badge variant="outline" className="font-mono">
                drift vs Layer {hiddenIdx - 1} {drift.toFixed(3)}
              </Badge>
            )}
          </div>
          <TokenMagnitudeBars
            tokens={tokens}
            perTokenNorms={perTokenNorms}
            attentionPair={attentionPair}
          />
          <p className="font-mono text-[11px] text-muted-foreground">
            Mean attention: Q (
            {shortToken(tokens[attentionPair.query] ?? `#${attentionPair.query}`)}){" → "}K (
            {shortToken(tokens[attentionPair.key] ?? `#${attentionPair.key}`)}) · weight{" "}
            {attentionPair.weight.toFixed(3)}
          </p>
        </>
      )}
      {hiddenIdx === 0 && !attentionPair && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-[11px]">Per-token representation magnitude</Label>
            <Badge variant="outline" className="font-mono">
              Layer 0 element RMS {rms?.toFixed(3) ?? "—"}
            </Badge>
          </div>
          <TokenMagnitudeBars tokens={tokens} perTokenNorms={perTokenNorms} />
        </>
      )}
      {layerMean && (
        <VectorStrip
          values={layerMean}
          label={
            hiddenIdx === 0
              ? `Layer 0 embeddings · token mean (${HIDDEN_SIZE} dims)`
              : `Layer ${hiddenIdx} token mean (${HIDDEN_SIZE} dims)`
          }
          note={`mean over ${tokens.length} active tokens`}
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        Token mean over the active tokens — a summary for interpretation. Layer 12's mean is exactly
        the pooled vector shown at step 13.
      </p>
    </div>
  );
}

function TokenContextPanel({
  tokens,
  perTokenNorms,
  magnitudeLabel,
}: {
  tokens: string[];
  perTokenNorms: number[];
  magnitudeLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">Input token context</Label>
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
            <Label className="text-[11px]">{magnitudeLabel}</Label>
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
  attentionPair,
}: {
  tokens: string[];
  perTokenNorms: number[];
  attentionPair?: { query: number; key: number; weight: number };
}) {
  const maxNorm = perTokenNorms.reduce((m, v) => Math.max(m, v), 0) || 1e-6;
  return (
    <div className="flex items-end gap-1">
      {perTokenNorms.map((normValue, t) => {
        const role =
          t === attentionPair?.query ? "query" : t === attentionPair?.key ? "key" : undefined;
        return (
          <div
            key={t}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
            role={role ? "group" : undefined}
            aria-label={
              role
                ? `${role === "query" ? "Query" : "Key"} token ${shortToken(tokens[t] ?? `#${t}`)}`
                : undefined
            }
          >
            <span className="h-3 font-mono text-[9px] font-semibold leading-3 text-red-600 dark:text-red-400">
              {role === "query" ? "Q" : role === "key" ? "K" : ""}
            </span>
            <div className="flex h-16 w-full items-end rounded-sm bg-muted/40">
              <div
                className={cn("w-full rounded-sm", role ? "bg-red-500" : "bg-[rgb(99,102,241)]")}
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
        );
      })}
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
