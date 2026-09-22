import { Lightbulb } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import { RecommendationParagraph } from "@/components/analysis";
import type { ILO, Recommendation } from "@/lib/types/types";

interface RecommendationCuesCardProps {
  recommendations: Recommendation[];
  ilos?: ILO[];
}

export function RecommendationCuesCard({ recommendations, ilos }: RecommendationCuesCardProps) {
  const sorted = [...recommendations].sort((a, b) => b.priority - a.priority);

  return (
    <AnalysisCard className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" /> Recommendation cues
        </CardTitle>
        <CardDescription>
          Hover the highlighted terms to see how each maps across pedagogical frameworks.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {sorted.length > 0 && (
          <div className="mb-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-primary/30 bg-primary/10" />
              <span>
                <span className="font-medium text-primary">Green</span> indicators denote{" "}
                <span className="font-medium text-foreground">Primary</span> recommendation cues —
                threshold-clearing pedagogical priorities (&ge;31%).
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-warning/30 bg-warning/10" />
              <span>
                <span className="font-medium text-warning">Amber</span> indicators denote{" "}
                <span className="font-medium text-foreground">Secondary</span> recommendation cues —
                highest frequency sub-threshold friction points (&lt;31%).
              </span>
            </p>
          </div>
        )}
        {sorted.length === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No recommendation cues needed for this session.
          </p>
        ) : (
          <div className="space-y-3">
            {sorted.map((rec) => (
              <RecommendationParagraph key={rec.id} rec={rec} ilos={ilos} />
            ))}
          </div>
        )}
      </CardContent>
    </AnalysisCard>
  );
}
