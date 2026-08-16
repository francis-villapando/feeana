import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, MessageSquare, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { useClassStore } from "@/lib/stores/classStore";
import { computeFeedbackStatus } from "@/lib/services/feedbackStatusService";
import { CountBadge } from "@/components/common";
import { formatSessionDate } from "@/lib/utils/formatSessionDate";
import { useSessionDisplayStatus } from "@/lib/hooks/useSessionDisplayStatus";
import { SessionEditDialog, ConfirmationDialog } from "@/components/faculty";
import { friendlyError } from "@/lib/hooks/utils";
import type { Session } from "@/lib/types/types";

const STATUS_BADGE: Record<string, { variant: "default" | "secondary"; className: string }> = {
  active: {
    variant: "default",
    className:
      "bg-[var(--color-chart-1)]/15 text-[var(--color-chart-1)] hover:bg-[var(--color-chart-1)]/25",
  },
  upcoming: {
    variant: "default",
    className:
      "bg-[var(--color-chart-3)]/15 text-[var(--color-chart-3)] hover:bg-[var(--color-chart-3)]/25",
  },
  closed: {
    variant: "default",
    className:
      "bg-[var(--color-chart-4)]/15 text-[var(--color-chart-4)] hover:bg-[var(--color-chart-4)]/25",
  },
  archived: { variant: "secondary", className: "" },
};

export function SessionCard({ session }: { session: Session }) {
  const { feedback } = useFeedbackStore();
  const { restoreSession } = useClassStore();
  const feedbackStatus = computeFeedbackStatus(session, feedback);
  const sessionFeedback = feedback.filter((f) => f.sessionId === session.id);
  const responses = sessionFeedback.length;
  const displayStatus = useSessionDisplayStatus(session);
  const badge = useMemo(
    () => STATUS_BADGE[displayStatus] ?? STATUS_BADGE.archived,
    [displayStatus],
  );
  const isArchived = displayStatus === "archived";
  const [editing, setEditing] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  const handleRestore = async () => {
    setRestoreError("");
    try {
      await restoreSession(session.id);
      toast.success("Session restored.");
      setConfirmRestore(false);
    } catch (err) {
      setRestoreError(friendlyError(err, "Failed to restore session"));
    }
  };

  return (
    <>
      <Card
        className={`border-border/60 backdrop-blur-xl transition hover:border-primary/40 bg-card/70 ${
          isArchived
            ? "bg-[image:repeating-linear-gradient(135deg,transparent,transparent_8px,color-mix(in_oklab,var(--foreground)_8%,transparent)_8px,color-mix(in_oklab,var(--foreground)_8%,transparent)_10px)]"
            : ""
        }`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 min-h-[2.75rem] text-base">
              {session.topic}
            </CardTitle>
            <Badge variant={badge.variant} className={`capitalize ${badge.className}`}>
              {displayStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {formatSessionDate(session.startsAt)} → {formatSessionDate(session.endsAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{responses} anonymous responses</span>
          </div>

          <div className="flex gap-2">
            {isArchived ? (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setRestoreError(""); setConfirmRestore(true); }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <div className="relative flex-1">
                  <Button asChild variant="secondary" size="sm" className="w-full">
                    <Link
                      to="/$classId/analysis/$sessionId"
                      params={{ classId: session.classId, sessionId: session.id }}
                    >
                      <span className="inline-flex items-center">Open analysis</span>
                    </Link>
                  </Button>
                  <CountBadge count={feedbackStatus.newCount} />
                </div>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <div className="relative flex-1">
                  <Button asChild variant="secondary" size="sm" className="w-full">
                    <Link
                      to="/$classId/analysis/$sessionId"
                      params={{ classId: session.classId, sessionId: session.id }}
                    >
                      <span className="inline-flex items-center">Open analysis</span>
                    </Link>
                  </Button>
                  <CountBadge count={feedbackStatus.newCount} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {editing && <SessionEditDialog session={session} onClose={() => setEditing(false)} />}

      {confirmRestore && (
        <ConfirmationDialog
          isOpen={confirmRestore}
          onClose={() => setConfirmRestore(false)}
          onConfirm={handleRestore}
          title="Restore session"
          description={`Restore the "${session.topic}" session?`}
          actionType="restore"
          confirmLabel="Restore"
          errorMessage={restoreError}
        />
      )}
    </>
  );
}
