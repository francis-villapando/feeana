import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, toTitleCase } from "@/lib/hooks/utils";
import type { Feedback, Polarity } from "@/lib/types/types";
import type { DiagnosticRecord } from "@/lib/algorithm/types";
import { RBT_LEVELS } from "@/lib/algorithm/rules";
import {
  ASPECT_COLOR_ORDER,
  ISSUE_COLOR_ORDER,
  POLARITY_COLOR_ORDER,
  RBT_COLOR_ORDER,
  CLT_COLOR_ORDER,
} from "@/lib/constants/chartColors";

export interface SessionFeedbackCategoryFilter {
  title: string;
  feedbackTexts?: string[];
}

interface SessionFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionFeedback: Feedback[];
  categoryFilter?: SessionFeedbackCategoryFilter | null;
  /** Per-feedback analysis mapping, keyed by feedback id. */
  diagnosticsByFeedbackId?: Map<string, DiagnosticRecord>;
}

const POLARITY_LABEL: Record<Polarity, string> = {
  pos: "Positive",
  neu: "Neutral",
  neg: "Negative",
};

const polarityColorMap = Object.fromEntries(POLARITY_COLOR_ORDER);
const aspectColorMap = Object.fromEntries(ASPECT_COLOR_ORDER);
const issueColorMap = Object.fromEntries(ISSUE_COLOR_ORDER);
const rbtColorMap = Object.fromEntries(RBT_COLOR_ORDER);
const cltColorMap = Object.fromEntries(CLT_COLOR_ORDER);

/** Feedback whose raw text appears in the category filter. */
export function filterFeedbackByCategory(
  sessionFeedback: Feedback[],
  categoryFilter?: SessionFeedbackCategoryFilter | null,
): Feedback[] {
  if (!categoryFilter) return [];
  const texts = new Set(categoryFilter.feedbackTexts ?? []);
  if (texts.size === 0) return [];
  return sessionFeedback.filter((f) => texts.has(f.rawText));
}

/** Case-insensitive substring match over raw/cleaned text. */
export function filterFeedbackByQuery(list: Feedback[], query: string): Feedback[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (f) => f.rawText.toLowerCase().includes(q) || f.cleanedText.toLowerCase().includes(q),
  );
}

export function SessionFeedbackModal({
  isOpen,
  onClose,
  sessionFeedback,
  categoryFilter,
  diagnosticsByFeedbackId,
}: SessionFeedbackModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[80vh] max-h-[640px] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle>Session feedback</DialogTitle>
          <DialogDescription>
            {sessionFeedback.length} response(s) submitted for this session.
          </DialogDescription>
        </DialogHeader>
        <SessionFeedbackList
          key={categoryFilter?.title ?? "all"}
          sessionFeedback={sessionFeedback}
          categoryFilter={categoryFilter}
          diagnosticsByFeedbackId={diagnosticsByFeedbackId}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Colored mapping pill. */
function MappingPill({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[11px] font-medium"
      style={{ color: color ?? "var(--color-muted-foreground)" }}
    >
      {label}
    </span>
  );
}

/** Modal body (exported for direct test rendering). */
export function SessionFeedbackList({
  sessionFeedback,
  categoryFilter,
  diagnosticsByFeedbackId,
}: {
  sessionFeedback: Feedback[];
  categoryFilter?: SessionFeedbackCategoryFilter | null;
  diagnosticsByFeedbackId?: Map<string, DiagnosticRecord>;
}) {
  const [view, setView] = useState<"category" | "all">(categoryFilter ? "category" : "all");
  const [query, setQuery] = useState("");

  const categoryFeedback = useMemo(
    () => filterFeedbackByCategory(sessionFeedback, categoryFilter),
    [sessionFeedback, categoryFilter],
  );

  const baseList = view === "category" ? categoryFeedback : sessionFeedback;

  const visible = useMemo(() => filterFeedbackByQuery(baseList, query), [baseList, query]);

  const isCategoryView = view === "category" && !!categoryFilter;
  const isEmptyCategory = isCategoryView && categoryFeedback.length === 0;
  const polarityOnly = categoryFilter?.title === "Positive" || categoryFilter?.title === "Neutral";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            aria-pressed={view === "category"}
            disabled={!categoryFilter}
            onClick={() => setView("category")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "category"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              !categoryFilter && "cursor-not-allowed opacity-50",
            )}
          >
            Selected Category ({categoryFeedback.length})
          </button>
          <button
            type="button"
            aria-pressed={view === "all"}
            onClick={() => setView("all")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All Feedback ({sessionFeedback.length})
          </button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search feedback…"
            className="h-8 pl-8 text-xs"
            aria-label="Search feedback"
          />
        </div>
      </div>

      {isCategoryView && categoryFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Showing feedback for</span>
          <Badge variant="secondary">{categoryFilter.title}</Badge>
        </div>
      )}

      <div className="chart-tooltip-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {isEmptyCategory
                ? "No feedback matches this category"
                : "No feedback matches your search"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isEmptyCategory
                ? "Switch to All Feedback to browse every response in this session."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((f) => {
              const diag = diagnosticsByFeedbackId?.get(f.id);
              const isUncategorized = diag?.issue === "Uncategorized";
              return (
                <li key={f.id} className="rounded-lg border border-border/60 bg-background/40 p-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    &ldquo;{f.rawText}&rdquo;
                  </p>
                  {diag && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!polarityOnly && (
                        <MappingPill label={diag.tti} color={aspectColorMap[diag.tti]} />
                      )}
                      {!polarityOnly && (
                        <MappingPill
                          label={toTitleCase(diag.issue)}
                          color={issueColorMap[toTitleCase(diag.issue)]}
                        />
                      )}
                      <MappingPill
                        label={POLARITY_LABEL[diag.polarity]}
                        color={polarityColorMap[POLARITY_LABEL[diag.polarity]]}
                      />
                      {!polarityOnly && !isUncategorized && (
                        <>
                          <MappingPill
                            label={RBT_LEVELS[diag.rbt] ?? String(diag.rbt)}
                            color={rbtColorMap[RBT_LEVELS[diag.rbt]]}
                          />
                          <MappingPill label={diag.clt} color={cltColorMap[diag.clt]} />
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
