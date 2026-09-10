import { AlertCircle, CheckCircle2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import type { IloStatus } from "@/lib/hooks/iloStatus";
import { RBT_LEVEL_NUMBERS } from "@/lib/constants/chartColors";

interface IloGapCardProps {
  statuses: IloStatus[];
}

export function IloGapCard({ statuses }: IloGapCardProps) {
  return (
    <AnalysisCard className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" /> ILO gap analysis
        </CardTitle>
        <CardDescription>
          Status of every intended learning outcome for this course.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {statuses.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No ILOs defined for selected topic.
          </p>
        ) : (
          [...statuses]
            .sort((a, b) => (RBT_LEVEL_NUMBERS[b.ilo.bloomLevel] ?? 0) - (RBT_LEVEL_NUMBERS[a.ilo.bloomLevel] ?? 0))
            .map(({ ilo, achieved, achievementRate, gapCount }) => (
            <div
              key={ilo.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
            >
              {achieved ? (
                <CheckCircle2 className="self-center h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="self-center h-5 w-5 shrink-0 text-destructive" />
              )}
              <div className="flex-1">
                <p className="text-sm leading-relaxed">{ilo.statement}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {achievementRate}% achieved
                  {gapCount > 0 && ` • ${gapCount} feedback gap${gapCount === 1 ? "" : "s"}`}
                </p>
              </div>
              <Badge
                variant="default"
                className="self-center shrink-0 text-[9px] px-1 h-3.5 font-normal uppercase tracking-tighter"
              >
                {ilo.bloomLevel} ({RBT_LEVEL_NUMBERS[ilo.bloomLevel] || "?"})
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </AnalysisCard>
  );
}
