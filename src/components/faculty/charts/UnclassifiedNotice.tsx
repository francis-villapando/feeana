import { Info } from "lucide-react";
import type { DistEntry } from "@/lib/types/types";
import { AccentLabel } from "./AccentLabel";

interface UnclassifiedNoticeProps {
  rbtDist: DistEntry[];
  cltDist: DistEntry[];
}

function countUncategorized(entries: DistEntry[]): number {
  return entries.find((e) => e.label === "Uncategorized")?.value ?? 0;
}

export function UnclassifiedNotice({ rbtDist, cltDist }: UnclassifiedNoticeProps) {
  const total = countUncategorized(rbtDist) + countUncategorized(cltDist);
  if (total === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-border/40 bg-background/50 px-3 py-2 text-xs text-muted-foreground lg:col-span-3">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="leading-relaxed italic">
        Feedback may be designated as <AccentLabel>Uncategorized</AccentLabel>{" "}
        due to processing errors, out-of-scope issues, missing or overly generic issue descriptions,
        and—crucially—<AccentLabel>Perceived Marginalization</AccentLabel>{" "}
        due to student beliefs that their feedback will be ignored or undervalued,
        which often falls outside standard classification boundaries.
      </p>
    </div>
  );
}
