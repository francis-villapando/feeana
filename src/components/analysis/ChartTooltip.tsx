import { type TooltipProps } from "recharts";
import type { DistEntry } from "@/lib/types";

export const chartTooltipProps = {
  cursor: { fill: "var(--color-border)" } as const,
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
    padding: "8px 12px",
  } as const,
};

export interface ChartTooltipContentProps extends TooltipProps<number, string> {
  colorMap?: Record<string, string>;
}

export function ChartTooltipContent({ active, payload, colorMap }: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload as DistEntry;
  const color =
    (colorMap && entry.label && colorMap[entry.label]) ??
    payload[0].color ??
    "var(--color-foreground)";
  return (
    <div style={chartTooltipProps.contentStyle}>
      <p style={{ fontWeight: 500, color, margin: 0 }}>
        {entry.label}
      </p>
      <p style={{ color: "var(--color-muted-foreground)", margin: 0, marginTop: 2 }}>
        Count: {entry.value}
      </p>
      {entry.feedbackTexts && entry.feedbackTexts.length > 0 && (
        <div
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
                  i < entry.feedbackTexts!.length - 1
                    ? "1px solid var(--color-border)"
                    : "none",
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
