import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NAMED_ISSUES } from "@/lib/algorithm/rules";

export interface UncategorizedReviewItem {
  feedbackId: string;
  rawText: string;
}

interface UncategorizedReviewModalProps {
  isOpen: boolean;
  items: UncategorizedReviewItem[];
  onSubmit: (overrides: Record<string, string>) => void;
  onSkip: () => void;
  submitting?: boolean;
}

/** Description copy framing the list as the faculty member's own review. */
export function uncategorizedReviewPrompt(count: number): string {
  return `${count} response(s) could not be automatically classified. These are listed for your review — assign a pedagogical issue to include a response in the analysis, or skip to leave it Uncategorized.`;
}

export function UncategorizedReviewModal({
  isOpen,
  items,
  onSubmit,
  onSkip,
  submitting,
}: UncategorizedReviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onSkip()}>
      <DialogContent
        data-tutorial="uncategorized-review-dialog"
        className="flex h-[80vh] max-h-[640px] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl"
      >
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle>Review uncategorized feedback</DialogTitle>
          <DialogDescription>{uncategorizedReviewPrompt(items.length)}</DialogDescription>
        </DialogHeader>
        <UncategorizedReviewList
          items={items}
          onSubmit={onSubmit}
          onSkip={onSkip}
          submitting={submitting}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Modal body (exported for direct test rendering). */
export function UncategorizedReviewList({
  items,
  onSubmit,
  onSkip,
  submitting,
}: {
  items: UncategorizedReviewItem[];
  onSubmit: (overrides: Record<string, string>) => void;
  onSkip: () => void;
  submitting?: boolean;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});

  return (
    <>
      <div className="chart-tooltip-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.feedbackId}
              className="rounded-lg border border-border/60 bg-background/40 p-4"
            >
              <p className="text-sm leading-relaxed text-foreground">
                &ldquo;{item.rawText}&rdquo;
              </p>
              <Select
                value={selections[item.feedbackId] ?? ""}
                onValueChange={(value) =>
                  setSelections((prev) => ({ ...prev, [item.feedbackId]: value }))
                }
              >
                <SelectTrigger className="mt-3" aria-label="Assign a pedagogical issue">
                  <SelectValue placeholder="Select an issue…" />
                </SelectTrigger>
                <SelectContent>
                  {NAMED_ISSUES.map((issue) => (
                    <SelectItem key={issue} value={issue}>
                      {issue}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </div>
      <DialogFooter className="border-t border-border/60 px-6 py-4">
        <Button variant="ghost" onClick={onSkip} disabled={submitting}>
          Skip
        </Button>
        <Button onClick={() => onSubmit(selections)} disabled={submitting}>
          Apply to analysis
        </Button>
      </DialogFooter>
    </>
  );
}
