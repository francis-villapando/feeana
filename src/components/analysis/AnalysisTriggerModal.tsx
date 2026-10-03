import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, PlayCircle, RefreshCw, Info, Sparkles, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTutorialStore } from "@/lib/tutorial/tutorialStore";

interface AnalysisTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  feedbackCount: number;
  studentSubmissionCount: number;
  studentCount: number;
  lastAnalyzedAt: string | null;
  newFeedbackCount: number;
}

export function AnalysisTriggerModal({
  isOpen,
  onClose,
  onConfirm,
  feedbackCount,
  studentSubmissionCount,
  studentCount,
  lastAnalyzedAt,
  newFeedbackCount,
}: AnalysisTriggerModalProps) {
  const { isActive: tutorialActive, step: tutorialStep } = useTutorialStore();
  const isTutorialStep = tutorialActive && tutorialStep?.id === "step-analysis-confirm";

  // Determine state
  const hasFeedback = feedbackCount > 0;
  const isFirstTime = lastAnalyzedAt === null;

  // SVG Progress Ring calculations
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const expectedCount = Math.max(studentCount, 1);
  // Imported rows are not participation, so the ring tracks students only.
  const percentage = Math.min(Math.round((studentSubmissionCount / expectedCount) * 100), 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isTutorialStep && onClose()}>
      <DialogContent
        data-tutorial="analysis-confirm"
        onInteractOutside={(e) => isTutorialStep && e.preventDefault()}
        onEscapeKeyDown={(e) => isTutorialStep && e.preventDefault()}
        className="max-w-md overflow-hidden border border-border/80 p-6 sm:rounded-2xl"
      >
        <DialogHeader className="space-y-3 text-center sm:text-left">
          {/* Header Icon & Title */}
          {!hasFeedback ? (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-4 ring-destructive/5 sm:mx-0">
              <AlertTriangle className="h-6 w-6 animate-bounce" />
            </div>
          ) : isFirstTime ? (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/5 sm:mx-0">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          ) : newFeedbackCount === 0 ? (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/5 sm:mx-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-4 ring-amber-500/5 sm:mx-0">
              <RefreshCw className="h-6 w-6 animate-spin-slow" />
            </div>
          )}

          <DialogTitle className="text-xl font-bold tracking-tight">
            {!hasFeedback
              ? "No feedback received yet"
              : isFirstTime
                ? "Ready to analyze session"
                : newFeedbackCount === 0
                  ? "Analysis up to date"
                  : "Re-run analysis?"}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {!hasFeedback
              ? "This class session currently has 0 feedback entries submitted by students. You cannot run the machine learning pipeline without any student feedback."
              : isFirstTime
                ? "The ML pipeline will analyze and extract aspects, categories, and issues from all student feedback submissions."
                : newFeedbackCount === 0
                  ? "There are no new student feedback entries since the last analysis run."
                  : `There are ${newFeedbackCount} new feedback entries submitted since the last run. A total of ${feedbackCount} responses will be re-analyzed.`}
          </DialogDescription>
        </DialogHeader>

        {/* Dynamic Modal Content Area */}
        {hasFeedback && (
          <div className="my-5 rounded-xl border border-border/50 bg-muted/30 p-4 shadow-inner">
            {isFirstTime ? (
              <div className="flex items-center gap-4">
                {/* SVG Progress Ring */}
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                  <svg className="h-16 w-16 -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      className="stroke-muted fill-none"
                      strokeWidth="6"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      className="stroke-primary fill-none transition-all duration-500 ease-out"
                      strokeWidth="6"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-xs font-bold text-foreground">{percentage}%</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Submission rate
                  </h4>
                  <p className="text-sm font-medium text-foreground">
                    {studentSubmissionCount} submission(s) received
                  </p>
                  <p className="text-xs text-muted-foreground">
                    out of {expectedCount} expected student(s)
                  </p>
                </div>
              </div>
            ) : newFeedbackCount === 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0 text-emerald-500" />
                  <p className="leading-normal">
                    You can force a re-run of the pipeline to recalculate aspect weights, polarity,
                    and theory-grounded teaching recommendations across all {feedbackCount}{" "}
                    submissions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>New submissions processing:</span>
                  <span className="font-semibold text-foreground">{newFeedbackCount}</span>
                </div>
                <Progress
                  value={(newFeedbackCount / feedbackCount) * 100}
                  className="h-1.5 w-full bg-primary/10 [&>div]:bg-primary"
                />
                <p className="text-xs text-muted-foreground leading-normal">
                  All {feedbackCount} submissions will be re-analyzed to ensure priority scores and
                  recommendations are accurately weighted globally across the class session.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isTutorialStep}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          {hasFeedback && (
            <Button
              onClick={() => {
                onClose();
                onConfirm();
              }}
              data-tutorial="analysis-confirm-btn"
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto shadow-md shadow-primary/20"
            >
              <PlayCircle className="h-4 w-4" />
              {isFirstTime
                ? "Start analysis"
                : newFeedbackCount === 0
                  ? "Force re-run"
                  : "Proceed with re-run"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
