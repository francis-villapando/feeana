import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Warning } from "@/lib/types/types";

interface WarningsCardProps {
  data: Warning[];
}

export function WarningsCard({ data }: WarningsCardProps) {
  if (data.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" /> Warnings
        </CardTitle>
        <CardDescription>
          Issues detected below the recommendation threshold.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...data].sort((a, b) => b.count - a.count).map((w) => (
          <div
            key={w.id}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3"
          >
            <p className="text-sm leading-relaxed">{w.issue}</p>
            <Badge
              variant="default"
              className="shrink-0 text-[9px] px-1 h-3.5 font-normal"
            >
              {w.count}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
