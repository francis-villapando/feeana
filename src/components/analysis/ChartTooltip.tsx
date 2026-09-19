import { useRef } from "react";
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
}

function FeedbackQuotes({ texts }: { texts: string[] }) {
  return (
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
      {texts.map((text, i) => (
        <p
          key={i}
          style={{
            margin: 0,
            padding: "4px 0",
            fontSize: 11,
            lineHeight: 1.4,
            color: "var(--color-foreground)",
            borderBottom: i < texts.length - 1 ? "1px solid var(--color-border)" : "none",
          }}
        >
          &ldquo;{text}&rdquo;
        </p>
      ))}
    </div>
  );
}

export function ChartTooltipContent({ active, payload, colorMap, dist }: ChartTooltipContentProps) {
  const frozenRef = useRef(false);
  const snapshotRef = useRef(payload ?? null);

  if (active && payload?.length) {
    snapshotRef.current = payload;
  }

  const visible = active || frozenRef.current;
  const data = frozenRef.current ? snapshotRef.current : payload;
  if (!visible || !data?.length) return null;

  const items = dist
    ? data.map((item) => {
        const label = String(item.dataKey ?? item.name ?? "");
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
      {sortedItems.map((item, index) => (
        <div
          key={item.label}
          style={dist && index < sortedItems.length - 1 ? { marginBottom: 8 } : undefined}
        >
          <p style={{ fontWeight: 500, color: item.color, margin: 0 }}>{toTitleCase(item.label)}</p>
          <p style={{ color: "var(--color-muted-foreground)", margin: 0, marginTop: 2 }}>
            Count: {item.value}
          </p>
          {item.feedbackTexts && item.feedbackTexts.length > 0 && (
            <FeedbackQuotes texts={item.feedbackTexts} />
          )}
        </div>
      ))}
    </div>
  );
}
