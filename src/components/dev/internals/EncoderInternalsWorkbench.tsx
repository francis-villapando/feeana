import { useCallback, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/hooks/utils";
import { NUM_HEADS, NUM_LAYERS, HIDDEN_SIZE, type ModelInternals } from "@/lib/algorithm/internals";
import type { ExtractionResult } from "@/components/dev/simulationEngine";
import { attentionLayerIndex } from "./walkthrough";
import { AttentionHeatmapExplorer } from "./AttentionHeatmapExplorer";
import { HiddenStateEvolutionChart } from "./HiddenStateEvolutionChart";
import { PoolingHeadInspector } from "./PoolingHeadInspector";
import { EncoderWalkthroughPlayer } from "./EncoderWalkthroughPlayer";

function InternalsSection({
  title,
  detail,
  defaultOpen = false,
  children,
}: {
  title: string;
  detail: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        "rounded-md border transition-colors",
        open ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        <span>
          <span className="block text-xs font-medium">{title}</span>
          <span className="block text-[11px] text-muted-foreground">{detail}</span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t border-border/60 p-3">{children}</div>}
    </div>
  );
}

export function EncoderInternalsWorkbench({ extraction }: { extraction: ExtractionResult }) {
  const internals: ModelInternals | undefined = extraction.internals;

  // Walkthrough state lives here so the player and the heatmap explorer can
  // stay in sync: scrubbing the player selects the matching layer, and picking
  // a layer in the explorer seeks the player (pausing playback).
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const handleWalkthroughStep = useCallback((s: number) => setWalkthroughStep(s), []);
  const handlePlayChange = useCallback((p: boolean) => setIsPlaying(p), []);
  const handleSpeedChange = useCallback((s: number) => setSpeed(s), []);
  const handleExplorerLayer = useCallback((l: number) => {
    setWalkthroughStep(l + 1);
    setIsPlaying(false);
  }, []);

  if (!internals || internals.activeTokens === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        Encoder internals unavailable for this run.
      </div>
    );
  }

  const subwords = extraction.tokenization.subwords;
  const sweepLayer = attentionLayerIndex(walkthroughStep);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-mono">
          <Layers className="mr-1 h-3 w-3" />
          {NUM_LAYERS} layers × {NUM_HEADS} heads
        </Badge>
        <Badge variant="outline" className="font-mono">
          {NUM_LAYERS + 1} hidden states
        </Badge>
        <Badge variant="outline" className="font-mono">
          {HIDDEN_SIZE}-dim pooled vector
        </Badge>
        <Badge variant="outline" className="font-mono">
          {internals.activeTokens} active tokens
        </Badge>
        <Badge variant="outline" className="font-mono">
          {internals.headWeights ? "head weights loaded" : "head weights missing"}
        </Badge>
      </div>

      <InternalsSection
        title="DistilXLM-R Live Encoding Walkthrough"
        detail="Media-player walkthrough of the encoder's 4-stage cognition"
      >
        <EncoderWalkthroughPlayer
          step={walkthroughStep}
          onStepChange={handleWalkthroughStep}
          isPlaying={isPlaying}
          onPlayChange={handlePlayChange}
          speed={speed}
          onSpeedChange={handleSpeedChange}
          internals={internals}
          subwords={subwords}
          topKIssues={extraction.topKIssues}
          issueLogitsRaw={extraction.issueLogitsRaw}
        />
      </InternalsSection>

      <InternalsSection
        title="1 · Attention distribution across all 144 heads"
        detail="Which tokens each attention head reads when encoding this feedback"
      >
        <AttentionHeatmapExplorer
          internals={internals}
          subwords={subwords}
          controlledLayer={sweepLayer >= 0 ? sweepLayer : undefined}
          onLayerSelect={handleExplorerLayer}
        />
      </InternalsSection>

      <InternalsSection
        title="2 · Hidden-state evolution across the 12 encoder layers"
        detail="How the representation of each token is rewritten layer by layer"
      >
        <HiddenStateEvolutionChart internals={internals} subwords={subwords} />
      </InternalsSection>

      <InternalsSection
        title="3 · Mean pooling and head projection"
        detail="The single sentence vector, and the exact w·v + b decomposition of each class logit"
      >
        <PoolingHeadInspector
          internals={internals}
          topKIssues={extraction.topKIssues}
          issueLogitsRaw={extraction.issueLogitsRaw}
        />
      </InternalsSection>
    </div>
  );
}
