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
