import { useEffect, useState } from "react";
import { Calendar, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { useClassStore } from "@/lib/stores/classStore";
import { friendlyError } from "@/lib/hooks/utils";
import { supabase } from "@/lib/db/supabase";

import { formatSessionDate } from "@/lib/utils/formatSessionDate";
import type { Session } from "@/lib/types/types";
import { InlineError, destructiveBorder } from "@/components/common";

interface SubmitFeedbackDialogProps {
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitFeedbackDialog({ session, open, onOpenChange }: SubmitFeedbackDialogProps) {
  const { addFeedback } = useFeedbackStore();
  const { classes, refreshEnrolledClasses, refreshSessions, addSubmittedSession } = useClassStore();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    if (!open || !session) return;
    setText("");
    setFeedbackError("");
  }, [open, session?.id]);

  if (!session) return null;

  const cls = classes.find((cls) => cls.id === session.classId);

  const handleClose = () => {
    setText("");
    setFeedbackError("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setFeedbackError("");
    if (text.trim().length < 4) {
      setFeedbackError("Feedback must be at least a few characters.");
      return;
    }

    setSubmitting(true);
    try {
      const [{ data: liveSession }, { data: enrollment }] = await Promise.all([
        supabase.from("sessions").select("status").eq("id", session.id).single(),
        supabase
          .from("enrollments")
          .select("id")
          .eq("class_id", session.classId)
          .is("removed_at", null),
      ]);

      if (liveSession?.status === "archived" || liveSession?.status === "closed") {
        toast.error("This session has been closed.");
        await Promise.all([refreshEnrolledClasses(), refreshSessions(session.classId)]);
        handleClose();
        return;
      }

      if (!enrollment || enrollment.length === 0) {
        toast.error("You are no longer enrolled in this class.");
        await Promise.all([refreshEnrolledClasses(), refreshSessions(session.classId)]);
        handleClose();
        return;
      }

      await addFeedback(session.id, text);
      addSubmittedSession(session.id);
      toast.success("Your feedback was recorded.");
      await Promise.all([refreshEnrolledClasses(), refreshSessions(session.classId)]);
      handleClose();
    } catch (e) {
      if (e instanceof Error && e.message === "duplicate_submission") {
        addSubmittedSession(session.id);
        toast.error("You've already submitted feedback for this session.");
        await Promise.all([refreshEnrolledClasses(), refreshSessions(session.classId)]);
        handleClose();
      } else {
        toast.error(friendlyError(e, "Failed to submit feedback. Please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit feedback</DialogTitle>
          <DialogDescription>
            Taglish is welcome — write naturally. Your submission is anonymous.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs tracking-widest text-muted-foreground">
            {cls ? `${cls.courseDisplay}` : "Session"}
          </p>
          <h3 className="text-sm font-semibold tracking-tight">{session.topic}</h3>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Open {formatSessionDate(session.startsAt)} → {formatSessionDate(session.endsAt)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFeedbackError("");
              }}
              placeholder="e.g. Sir mabilis po yung discussion sa typecasting, hirap mahabol…"
              className={`min-h-[120px] resize-none ${feedbackError ? destructiveBorder : ""}`}
              maxLength={500}
            />
            <InlineError errorMessage={feedbackError} />
            <p className="text-right text-[11px] text-muted-foreground">{text.length} / 500</p>
          </div>
          <div className="space-y-3">
            <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
              <Send className="h-4 w-4" />
              {submitting ? "Submitting…" : "Submit feedback"}
            </Button>
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Read the privacy policy
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
