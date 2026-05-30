import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { computeFeedbackStatus } from "@/lib/services/feedbackStatusService";
import { FeedbackStatusBadge } from "@/components/analysis/FeedbackStatusBadge";
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
  const feedbackStatus = computeFeedbackStatus(session, feedback);
  const sessionFeedback = feedback.filter((f) => f.sessionId === session.id);
  const responses = sessionFeedback.length;
  const preview = sessionFeedback.slice(0, 3);

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl transition hover:border-primary/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{session.topic}</CardTitle>
          <Badge
            variant={session.status === "active" ? "default" : "secondary"}
            className={
              session.status === "active" ? "bg-primary/15 text-primary hover:bg-primary/20" : ""
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
          <span>{responses} anonymous responses</span>
        </div>

        {preview.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="preview" className="border-border/60">
              <AccordionTrigger className="py-2 text-xs">
                Latest anonymous feedback
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {preview.map((f) => (
                    <li
                      key={f.id}
                      className="rounded-md border border-border/40 bg-background/40 px-2.5 py-2 text-xs italic text-muted-foreground"
                    >
                      “{f.rawText}”
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        <div className="relative">
          <Button asChild variant="ghost" size="sm" className="w-full justify-between">
            <Link
              to="/$classId/analysis/$sessionId"
              params={{ classId: session.classId, sessionId: session.id }}
            >
              Open analysis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <FeedbackStatusBadge count={feedbackStatus.newCount} />
        </div>
      </CardContent>
    </Card>
  );
}
