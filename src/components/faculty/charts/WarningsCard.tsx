import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import type { Warning } from "@/lib/types/types";

interface WarningsCardProps {
  data: Warning[];
}

export function WarningsCard({ data }: WarningsCardProps) {

  return (
    <AnalysisCard className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" /> Warnings
        </CardTitle>
        <CardDescription>
          Issues detected below the recommendation threshold.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No warning for this session.
          </p>
        ) : (
          [...data].sort((a, b) => b.count - a.count).map((w) => (
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
          ))
        )}
      </CardContent>
    </AnalysisCard>
  );
}
