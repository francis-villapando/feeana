import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatSessionDate } from "@/lib/utils/formatSessionDate";
import type { Session } from "@/lib/types/types";

interface SessionCardProps {
  session: Session;
  onSubmit?: (session: Session) => void;
}

export function SessionCard({ session, onSubmit }: SessionCardProps) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl transition hover:border-primary/40">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-medium">{session.topic}</h3>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatSessionDate(session.startsAt)} → {formatSessionDate(session.endsAt)}
          </p>
        </div>
        <Button onClick={() => onSubmit?.(session)} className="w-full sm:w-auto">
          Draft feedback <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
