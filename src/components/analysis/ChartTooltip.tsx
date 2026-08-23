import { useRef } from "react";
import { type TooltipProps } from "recharts";
import type { DistEntry } from "@/lib/types/types";

export const chartTooltipProps = {
  cursor: { fill: "var(--color-border)" } as const,
  wrapperStyle: { pointerEvents: "auto" } as const,
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
    padding: "8px 12px",
    pointerEvents: "auto",
  } as const,
};

export interface ChartTooltipContentProps extends TooltipProps<number, string> {
  colorMap?: Record<string, string>;
}

export function ChartTooltipContent({ active, payload, colorMap }: ChartTooltipContentProps) {
  const frozenRef = useRef(false);
  const snapshotRef = useRef(payload ?? null);

  if (active && payload?.length) {
    snapshotRef.current = payload;
  }

  const visible = active || frozenRef.current;
  const data = frozenRef.current ? snapshotRef.current : payload;
  if (!visible || !data?.length) return null;

  const entry = data[0].payload as DistEntry;
  const color =
    (colorMap && entry.label && colorMap[entry.label]) ??
    data[0].color ??
    "var(--color-foreground)";

  return (
    <div
      onMouseEnter={() => {
        frozenRef.current = true;
      }}
      onMouseLeave={() => {
        frozenRef.current = false;
      }}
      onMouseMove={(e) => {
        if (frozenRef.current) e.stopPropagation();
      }}
      style={chartTooltipProps.contentStyle}
    >
      <p style={{ fontWeight: 500, color, margin: 0 }}>{entry.label}</p>
      <p style={{ color: "var(--color-muted-foreground)", margin: 0, marginTop: 2 }}>
        Count: {entry.value}
      </p>
      {entry.feedbackTexts && entry.feedbackTexts.length > 0 && (
        <div
          className="chart-tooltip-scrollbar"
          onWheel={(e) => e.stopPropagation()}
          style={{
            marginTop: 6,
            maxHeight: 220,
            overflowY: "auto",
            borderTop: "1px solid var(--color-border)",
            paddingTop: 6,
            width: 380,
          }}
        >
          {entry.feedbackTexts.map((text, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                padding: "4px 0",
                fontSize: 11,
                lineHeight: 1.4,
                color: "var(--color-foreground)",
                borderBottom:
                  i < entry.feedbackTexts!.length - 1 ? "1px solid var(--color-border)" : "none",
              }}
            >
              &ldquo;{text}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
