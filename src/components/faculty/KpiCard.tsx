import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            {icon}
          </span>
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
