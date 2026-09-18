import { AlertCircle, CheckCircle2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import type { IloStatus } from "@/lib/hooks/iloStatus";
import { classifyIloLevels, perLevelGapCounts } from "@/lib/hooks/iloClassification";
import { RBT_LEVELS, RBT_LEVEL_NUMBERS } from "@/lib/algorithm/rules";
import type { GapItem } from "@/lib/types/types";

interface IloGapCardProps {
  statuses: IloStatus[];
  gaps?: GapItem[];
}

function gapSuffix(count: number): string {
  return count > 0 ? ` · ${count} gap${count === 1 ? "" : "s"}` : "";
}

export function IloGapCard({ statuses, gaps = [] }: IloGapCardProps) {
  return (
    <AnalysisCard className="lg:col-span-12">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" /> ILO gap analysis
        </CardTitle>
        <CardDescription>
          Status of every intended learning outcome for this course.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {statuses.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No ILOs defined for selected topic.
          </p>
        ) : (
          [...statuses]
            .sort(
              (a, b) =>
                (RBT_LEVEL_NUMBERS[a.ilo.bloomLevel] ?? 0) -
                (RBT_LEVEL_NUMBERS[b.ilo.bloomLevel] ?? 0),
            )
            .map(({ ilo, achieved, achievementRate, gapCount }) => {
              const goalLevel = RBT_LEVEL_NUMBERS[ilo.bloomLevel] ?? 1;
              const levels = classifyIloLevels(goalLevel);
              const cascadeNums = levels.filter((l) => l.cls === "cascade").map((l) => l.num);
              const oobNums = levels.filter((l) => l.cls === "out-of-bound").map((l) => l.num);
              const gapCountsByLevel = perLevelGapCounts(gaps, ilo.id);

              return (
                <div
                  key={ilo.id}
                  className="rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="flex items-start gap-2 text-sm leading-relaxed">
                        {achieved ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                        )}
                        <span>{ilo.statement}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-tighter text-muted-foreground">
                          ILO Level
                        </span>
                        <Badge variant="default" className="px-2 text-[10px] font-normal">
                          {RBT_LEVELS[goalLevel]}
                          {gapSuffix(gapCountsByLevel.get(goalLevel) ?? 0)}
                        </Badge>
                      </div>
                      {cascadeNums.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground">
                            Cascade
                          </span>
                          {cascadeNums.map((num) => (
                            <Badge
                              key={num}
                              variant="secondary"
                              className="px-2 text-[10px] font-normal"
                            >
                              {RBT_LEVELS[num]}
                              {gapSuffix(gapCountsByLevel.get(num) ?? 0)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {oobNums.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground">
                            Out of scope
                          </span>
                          {oobNums.map((num) => (
                            <Badge
                              key={num}
                              variant="secondary"
                              className="px-2 text-[10px] font-normal"
                            >
                              {RBT_LEVELS[num]}
                              {gapSuffix(gapCountsByLevel.get(num) ?? 0)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:justify-center">
                      <div className="flex-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-center text-xs font-medium text-destructive sm:w-24 sm:flex-none">
                        {gapCount} feedback gap{gapCount === 1 ? "" : "s"}
                      </div>
                      <div className="flex-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-center text-xs font-medium text-primary sm:w-24 sm:flex-none">
                        {achievementRate}% achieved
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </CardContent>
    </AnalysisCard>
  );
}
