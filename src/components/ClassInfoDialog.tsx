import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassStore } from "@/lib/classStore";
import * as feedbackService from "@/lib/services/feedbackService";
import type { Class } from "@/lib/types";

interface ClassInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cls: Class;
  studentId: string;
}

export function ClassInfoDialog({
  open,
  onOpenChange,
  cls,
  studentId,
}: ClassInfoDialogProps) {
  const { sessions: allSessions, refreshSessions } = useClassStore();
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const sessions = useMemo(
    () => allSessions.filter((s) => s.classId === cls.id && s.status === "closed"),
    [allSessions, cls.id],
  );

  useEffect(() => {
    if (!open) return;

    setIsLoading(true);

    Promise.all([
      refreshSessions(cls.id),
      feedbackService.getFeedbackByClass(cls.id),
    ])
      .then(([, feedback]) => {
        const ids = feedback
          .filter((f) => f.submittedBy === studentId)
          .map((f) => f.sessionId);
        setSubmittedIds(new Set(ids));
      })
      .catch(() => {
        toast.error("Failed to load participation data");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, cls.id, studentId, refreshSessions]);

  const copyCode = () => {
    navigator.clipboard.writeText(cls.code);
    toast.success("Enrollment code copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cls.course}</DialogTitle>
          <DialogDescription>
            {cls.facultyName && <>{cls.facultyName} · </>}Section {cls.section}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <button
            type="button"
            onClick={copyCode}
            className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm hover:border-primary/40"
          >
            <span className="text-muted-foreground">Enrollment code</span>
            <span className="flex items-center gap-2 font-mono tracking-wider">
              {cls.code}
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </button>

          <div className="border-t border-border/60" />

          <div>
            <h4 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Participation history
            </h4>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No closed sessions yet.
              </p>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => {
                  const submitted = submittedIds.has(session.id);
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-md px-2 py-2 transition hover:bg-muted/50"
                    >
                      <span className="text-sm">{session.topic}</span>
                      {submitted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <Check className="h-3.5 w-3.5" /> Submitted
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Missed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
