import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationParagraph } from "@/components/analysis";
import type { ILO, Recommendation } from "@/lib/types/types";

interface RecommendationCuesCardProps {
  recommendations: Recommendation[];
  ilos?: ILO[];
}

export function RecommendationCuesCard({ recommendations, ilos }: RecommendationCuesCardProps) {
  const sorted = [...recommendations].sort((a, b) => b.priority - a.priority);

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" /> Recommendation cues
        </CardTitle>
        <CardDescription>
          Hover the highlighted terms to see how each maps across pedagogical frameworks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No recommendation cues needed for this session.
          </p>
        ) : (
          <ol className="space-y-3">
            {sorted.map((rec, i) => (
              <RecommendationParagraph key={rec.id} rec={rec} index={i} ilos={ilos} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
