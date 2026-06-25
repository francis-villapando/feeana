import { Link } from "@tanstack/react-router";
import { Calendar, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeedbackStore } from "@/lib/stores/feedbackStore";
import { computeFeedbackStatus } from "@/lib/services/feedbackStatusService";
import { CountBadge } from "@/components/common";
import { formatSessionDate } from "@/lib/utils/formatSessionDate";
import { useSessionDisplayStatus } from "@/lib/hooks/useSessionDisplayStatus";
import type { Session } from "@/lib/types/types";

export function SessionCard({ session }: { session: Session }) {
  const { feedback } = useFeedbackStore();
  const feedbackStatus = computeFeedbackStatus(session, feedback);
  const sessionFeedback = feedback.filter((f) => f.sessionId === session.id);
  const responses = sessionFeedback.length;
  const displayStatus = useSessionDisplayStatus(session);

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl transition hover:border-primary/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 min-h-[2.75rem] text-base">{session.topic}</CardTitle>
          <Badge
            variant={displayStatus === "active" ? "default" : "secondary"}
            className={`capitalize ${
              displayStatus === "active" ? "bg-primary/15 text-primary hover:bg-primary/20" : ""
            }`}
          >
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

        <div className="relative">
          <Button asChild variant="secondary" size="sm" className="w-full">
            <Link
              to="/$classId/analysis/$sessionId"
              params={{ classId: session.classId, sessionId: session.id }}
            >
              <span className="inline-flex items-center">
                Open analysis
              </span>
            </Link>
          </Button>
          <CountBadge count={feedbackStatus.newCount} />
        </div>
      </CardContent>
    </Card>
  );
}
