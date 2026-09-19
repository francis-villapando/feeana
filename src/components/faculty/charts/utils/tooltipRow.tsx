import type { ReactNode } from "react";

interface TooltipRowProps {
  color?: string;
  label?: ReactNode;
  value: ReactNode;
}

/** Row rendered inside ChartTooltipContent's formatter branch, which replaces the default row. */
export function TooltipRow({ color, label, value }: TooltipRowProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
