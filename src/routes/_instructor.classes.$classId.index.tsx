import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { SessionCard } from "@/components/SessionCard";
import { useClassStore } from "@/lib/classStore";

export const Route = createFileRoute("/_instructor/classes/$classId/")({
  component: ClassSessionsTab,
});

function ClassSessionsTab() {
  const { classId } = Route.useParams();
  const { sessionsForClass } = useClassStore();
  const sessions = sessionsForClass(classId);

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 text-base font-semibold">No collections yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Start your first feedback collection from the form above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </div>
  );
}
