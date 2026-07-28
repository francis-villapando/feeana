import { useState } from "react";
import { Archive, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useClassStore } from "@/lib/stores/classStore";
import type { Session } from "@/lib/types/types";
import { ConfirmationDialog, DateTimePicker } from "@/components/faculty";
import { InlineError, destructiveBorder } from "@/components/common";

interface SessionEditDialogProps {
  session: Session;
  onClose: () => void;
}

export function SessionEditDialog({ session, onClose }: SessionEditDialogProps) {
  const { updateSession, archiveSession } = useClassStore();

  const [topic, setTopic] = useState(session.topic);
  const [startsAt, setStartsAt] = useState(session.startsAt);
  const [endsAt, setEndsAt] = useState(session.endsAt);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [topicError, setTopicError] = useState("");
  const [startsAtError, setStartsAtError] = useState("");
  const [endsAtError, setEndsAtError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const handleSave = async () => {
    setTopicError("");
    setStartsAtError("");
    setEndsAtError("");
    setSubmitError("");

    if (!topic.trim()) {
      setTopicError("Topic is required.");
      return;
    }
    if (!startsAt) {
      setStartsAtError("Pick a start date/time.");
      return;
    }
    if (!endsAt) {
      setEndsAtError("Pick an end date/time.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setEndsAtError("End must be after start.");
      return;
    }
    if (new Date(endsAt) <= new Date()) {
      setEndsAtError("End time cannot be in the past.");
      return;
    }

    setSaving(true);
    try {
      await updateSession(session.id, { topic: topic.trim(), startsAt, endsAt });
      toast.success("Session updated.");
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update session");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveSession(session.id);
      toast.success("Session archived.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive session");
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Edit session
            </DialogTitle>
            <DialogDescription>
              Update the session details below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-topic">Topic</Label>
              <Input
                id="edit-topic"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setTopicError("");
                }}
                placeholder="Session topic"
                className={topicError ? destructiveBorder : ""}
              />
              <InlineError errorMessage={topicError} />
            </div>
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <DateTimePicker
                value={startsAt}
                onChange={(v) => {
                  setStartsAt(v);
                  setStartsAtError("");
                }}
                className={startsAtError ? destructiveBorder : ""}
              />
              <InlineError errorMessage={startsAtError} />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <DateTimePicker
                value={endsAt}
                onChange={(v) => {
                  setEndsAt(v);
                  setEndsAtError("");
                }}
                className={endsAtError ? destructiveBorder : ""}
              />
              <InlineError errorMessage={endsAtError} />
            </div>
            <InlineError errorMessage={submitError} />
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => setConfirmArchive(true)}
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archive
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving\u2026" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmArchive && (
        <ConfirmationDialog
          isOpen={confirmArchive}
          onClose={() => setConfirmArchive(false)}
          onConfirm={handleArchive}
          title="Archive session"
          description={`Archive the "${session.topic}" session?`}
          actionType="archive"
          confirmLabel="Archive"
        />
      )}
    </>
  );
}
