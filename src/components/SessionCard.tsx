import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFeedbackStore } from "@/lib/feedbackStore";
import type { Session } from "@/lib/types";

function formatDT(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SessionCard({ session }: { session: Session }) {
  const { feedback } = useFeedbackStore();
  const responses = feedback.filter((f) => f.sessionId === session.id).length;

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl transition hover:border-primary/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{session.topic}</CardTitle>
          <Badge
            variant={session.status === "active" ? "default" : "secondary"}
            className={
              session.status === "active"
                ? "bg-primary/15 text-primary hover:bg-primary/20"
                : ""
            }
          >
            {session.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {formatDT(session.startsAt)} → {formatDT(session.endsAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{responses} responses</span>
        </div>
        <Button asChild variant="ghost" size="sm" className="w-full justify-between">
          <Link
            to="/classes/$classId/analysis/$sessionId"
            params={{ classId: session.classId, sessionId: session.id }}
          >
            Open analysis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
