import { Loader2 } from "lucide-react";
import { chartTooltipProps } from "@/components/analysis";

export type ChartId = "aspect" | "issue" | "polarity" | "rbt" | "clt";

export type FeedbackOpenState =
  | { status: "idle" }
  | { status: "opening"; chartId: ChartId }
  | { status: "error"; chartId: ChartId; error: string };

export interface FeedbackOpenPanelProps {
  status: "opening" | "error";
  error?: string;
  onCancel: () => void;
  onRetry?: () => void;
  /** Anchor point for the panel; falls back to centered. */
  anchor?: { x: number; y: number } | null;
}

/** Cursor-independent "opening feedback" status rendered outside recharts' tooltip. */
export function FeedbackOpenPanel({
  status,
  error,
  onCancel,
  onRetry,
  anchor,
}: FeedbackOpenPanelProps) {
  return (
    <div
      className="pointer-events-none absolute z-50"
      style={
        anchor
          ? { left: anchor.x, top: anchor.y }
          : { inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }
      }
    >
      <div
        className="pointer-events-auto flex min-w-[180px] flex-col gap-2"
        style={chartTooltipProps.contentStyle}
      >
        {status === "opening" ? (
          <>
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span style={{ fontWeight: 500 }}>Opening feedback…</span>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="self-start rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 500, margin: 0 }}>Couldn&rsquo;t open feedback</p>
            {error && (
              <p style={{ color: "var(--color-muted-foreground)", margin: 0, fontSize: 11 }}>
                {error}
              </p>
            )}
            <div className="flex gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-accent/60"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
