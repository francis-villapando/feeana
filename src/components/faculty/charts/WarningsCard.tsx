import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AnalysisCard } from "./AnalysisCard";
import { cn, toTitleCase } from "@/lib/hooks/utils";
import { CLT_DESCRIPTIONS } from "@/lib/algorithm/rules";
import type { Warning, RecommendationTerm } from "@/lib/types/types";

const TERM_KIND_LABEL: Record<string, string> = {
  prevalence: "Prevalence",
  issue: "Issue",
  TTI: "Teaching Through Interactions",
  RBT: "Revised Bloom's Taxonomy",
  CLT: "Cognitive Load Theory",
};

const VISIBLE_TERM_KINDS = new Set(["prevalence", "TTI", "RBT", "CLT"]);

interface WarningsCardProps {
  data: Warning[];
}

function WarningTooltipContent({ terms }: { terms: RecommendationTerm[] }) {
  const visibleTerms = terms.filter((term) => VISIBLE_TERM_KINDS.has(term.kind));
  return (
    <div className="space-y-2">
      {visibleTerms.map((term) => (
        <div key={term.kind}>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {TERM_KIND_LABEL[term.kind] ?? term.kind}
          </p>
          <p className="text-sm leading-relaxed">{term.text}</p>
        </div>
      ))}
    </div>
  );
}

function isIntrinsicCue(warning: Warning): boolean {
  return warning.terms.some(
    (term) => term.kind === "CLT" && term.text.toLowerCase() === "intrinsic",
  );
}

export function WarningsCard({ data }: WarningsCardProps) {
  const sorted = [...data].sort((a, b) => b.priority - a.priority);

  return (
    <AnalysisCard className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" /> Warnings
        </CardTitle>
        <CardDescription>Issues detected below the recommendation threshold.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-destructive/30 bg-destructive/10" />
            <span>
              <span className="font-medium text-destructive">Red</span> badges denote{" "}
              <span className="font-medium text-foreground">Intrinsic</span> cognitive load —{" "}
              {CLT_DESCRIPTIONS.Intrinsic.label}.
            </span>
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border/60 bg-background/40" />
            <span>
              <span className="font-medium text-foreground">Neutral</span> badges denote{" "}
              <span className="font-medium text-foreground">Extraneous</span> cognitive load —{" "}
              {CLT_DESCRIPTIONS.Extraneous.label}.
            </span>
          </p>
        </div>
        {sorted.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No warning for this session.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sorted.map((warning) => {
              const intrinsic = isIntrinsicCue(warning);
              return (
                <HoverCard key={warning.id} openDelay={120} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        intrinsic
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-border/60 bg-background/40 text-foreground hover:bg-accent/50",
                      )}
                    >
                      {toTitleCase(warning.issue)}
                      <Badge
                        variant={intrinsic ? "destructive" : "secondary"}
                        className="shrink-0 text-[9px] px-1 h-3.5 font-normal"
                      >
                        {warning.count}
                      </Badge>
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-72" align="start">
                    <WarningTooltipContent terms={warning.terms} />
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>
        )}
      </CardContent>
    </AnalysisCard>
  );
}
