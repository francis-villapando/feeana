import { useEffect, useRef } from "react";
import { type TooltipProps } from "recharts";
import type { DistEntry } from "@/lib/types/types";
import { toTitleCase } from "@/lib/hooks/utils";

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
  dist?: DistEntry[];
  onSelect?: (entry: { label: string; feedbackTexts?: string[] }) => void;
  /** Freeze on pointerdown so the tooltip tracks while the cursor sweeps the chart. */
  freezeOnClick?: boolean;
  /** Reports the tooltip's chart-relative coordinate while active. */
  onCoordinateChange?: (coordinate: { x: number; y: number } | null) => void;
}

export function ChartTooltipContent({
  active,
  payload,
  colorMap,
  dist,
  onSelect,
  freezeOnClick,
  onCoordinateChange,
  coordinate,
}: ChartTooltipContentProps) {
  const frozenRef = useRef(false);
  const snapshotRef = useRef(payload ?? null);

  useEffect(() => {
    onCoordinateChange?.(active && payload?.length ? (coordinate ?? null) : null);
  }, [active, payload, coordinate, onCoordinateChange]);

  if (active && payload?.length) {
    snapshotRef.current = payload;
  }

  const visible = active || frozenRef.current;
  const data = frozenRef.current ? snapshotRef.current : payload;
  if (!visible || !data?.length) return null;

  const items = dist
    ? data.map((item) => {
        // Row payload labels first (bar/pie); radar vertices fall back to `name` then key.
        const label = String(
          (item.payload as DistEntry | undefined)?.label ??
            (item.payload as { name?: string } | undefined)?.name ??
            item.dataKey ??
            item.name ??
            "",
        );
        const entry = dist.find((d) => d.label === label);
        return {
          label,
          value: item.value,
          color: (colorMap && colorMap[label]) ?? item.color ?? "var(--color-foreground)",
          feedbackTexts: entry?.feedbackTexts,
        };
      })
    : [
        {
          label: (data[0].payload as DistEntry).label,
          value: (data[0].payload as DistEntry).value,
          color:
            (colorMap &&
              (data[0].payload as DistEntry).label &&
              colorMap[(data[0].payload as DistEntry).label]) ??
            data[0].color ??
            "var(--color-foreground)",
          feedbackTexts: (data[0].payload as DistEntry).feedbackTexts,
        },
      ];

  const sortedItems = [...items].sort((a, b) => (b.value as number) - (a.value as number));

  return (
    <div
      onMouseEnter={() => {
        if (!freezeOnClick) frozenRef.current = true;
      }}
      onMouseLeave={() => {
        frozenRef.current = false;
      }}
      onPointerDown={() => {
        if (freezeOnClick) frozenRef.current = true;
      }}
      onMouseMove={(e) => {
        if (frozenRef.current) e.stopPropagation();
      }}
      style={chartTooltipProps.contentStyle}
    >
      {sortedItems.map((item, index) => (
        <button
          key={item.label}
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect?.({ label: item.label, feedbackTexts: item.feedbackTexts })}
          className={onSelect ? "hover:bg-accent/60" : undefined}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            background: "transparent",
            border: "none",
            padding: 0,
            margin: 0,
            borderRadius: 4,
            cursor: onSelect ? "pointer" : "default",
            ...(dist && index < sortedItems.length - 1 ? { marginBottom: 8 } : undefined),
          }}
        >
          <p style={{ fontWeight: 500, color: item.color, margin: 0 }}>{toTitleCase(item.label)}</p>
          <p style={{ color: "var(--color-muted-foreground)", margin: 0, marginTop: 2 }}>
            Count: {item.value}
          </p>
        </button>
      ))}
    </div>
  );
}
