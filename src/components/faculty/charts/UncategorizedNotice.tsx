import { Info } from "lucide-react";
import { useState } from "react";
import { AccentLabel } from "./AccentLabel";

interface UncategorizedNoticeProps {
  count: number;
  totalFeedback: number;
  feedbackTexts?: string[];
}

export function UncategorizedNotice({
  count,
  totalFeedback,
  feedbackTexts,
}: UncategorizedNoticeProps) {
  const [expanded, setExpanded] = useState(false);
  if (count === 0) return null;

  const pct = totalFeedback === 0 ? 0 : Math.round((count / totalFeedback) * 100);
  const texts = feedbackTexts ?? [];

  return (
    <div className="rounded-md border border-border/40 bg-background/50 px-3 py-2 text-xs text-muted-foreground lg:col-span-12">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="flex-1 leading-relaxed">
          <p>
            <span className="font-medium text-foreground">
              {count} of {totalFeedback} responses ({pct}%)
            </span>{" "}
            could not be mapped to a standard classification and are excluded from the distributions
            above.
          </p>
          <p className="mt-1 italic">
            Feedback may be designated as <AccentLabel>Uncategorized</AccentLabel> due to processing
            errors, out-of-scope issues, missing or overly generic issue descriptions,
            and—crucially—
            <AccentLabel>Perceived Marginalization</AccentLabel> due to student beliefs that their
            feedback will be ignored or undervalued, which often falls outside standard
            classification boundaries.
          </p>
          {texts.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[10px] font-medium text-primary underline-offset-2 hover:underline"
            >
              {expanded ? "Hide" : "Show"} {texts.length} unmapped feedback{" "}
              {texts.length === 1 ? "quote" : "quotes"}
            </button>
          )}
        </div>
      </div>
      {expanded && texts.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
          {texts.map((text, i) => (
            <p key={i} className="text-[11px] leading-relaxed text-foreground/80">
              &ldquo;{text}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
