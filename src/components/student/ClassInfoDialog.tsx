import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, Copy, LogOut, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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

function formatDT(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ClassInfoDialog({
  open,
  onOpenChange,
  cls,
  studentId,
}: ClassInfoDialogProps) {
  const { sessions: allSessions, refreshSessions, unenrollStudent } = useClassStore();
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [confirmUnenroll, setConfirmUnenroll] = useState(false);
  const navigate = useNavigate();

  const sessions = useMemo(
    () => allSessions.filter((s) => s.classId === cls.id && (s.status === "closed" || submittedIds.has(s.id))),
    [allSessions, cls.id, submittedIds],
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

  const handleUnenroll = async () => {
    await unenrollStudent(cls.id);
    setConfirmUnenroll(false);
    onOpenChange(false);
    toast.success("You have left the class");
    navigate({ to: "/student/home" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle>{cls.course}</DialogTitle>
          <DialogDescription>
            {cls.facultyName && <>{cls.facultyName} \u00b7 </>}{cls.section}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto">
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

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-red-500 hover:text-red-600 hover:border-red-300/50"
            onClick={() => setConfirmUnenroll(true)}
          >
            <LogOut className="h-4 w-4" />
            Unenroll
          </Button>

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
                      <div>
                        <span className="text-sm">{session.topic}</span>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDT(session.startsAt)}
                          <span className="text-muted-foreground/50">\u2192</span>
                          {formatDT(session.endsAt)}
                        </p>
                      </div>
                      {submitted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <Check className="h-3.5 w-3.5" /> Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                          <X className="h-3.5 w-3.5" /> Missed
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={confirmUnenroll} onOpenChange={setConfirmUnenroll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unenroll from {cls.course}?</AlertDialogTitle>
            <AlertDialogDescription>
              You lose access to this class. Your submitted feedback stays. You can rejoin anytime with the class code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleUnenroll}
            >
              Unenroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
