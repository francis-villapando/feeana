import { useMemo, useState } from "react";
import { Activity, BookOpen, ListChecks, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCourseStore } from "@/lib/courseStore";
import type { ActivityEntry, EntityKind, Course, Topic, ILO } from "@/lib/types";
import { ActivityFeedDialog } from "./ActivityFeedDialog";

const ICONS: Record<EntityKind, typeof BookOpen> = {
  course: BookOpen,
  topic: ListChecks,
  ILO: Target,
};

function withinDays(iso: string, days: number) {
  const t = new Date(iso).getTime();
  return Date.now() - t < days * 24 * 60 * 60 * 1000;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just Now";
  if (m < 60) return `${m}m Ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h Ago`;
  const d = Math.floor(h / 24);
  return `${d}d Ago`;
}

import { getIloPath, getTopicPath } from "@/lib/hierarchy";

export function ActivityFeed() {
  const { activity, currentUserId, courses, topics, ilos } = useCourseStore();
  const [open, setOpen] = useState(false);

  const recent = useMemo(() => activity.filter((a) => withinDays(a.timestamp, 30)), [activity]);
  const top = recent.slice(0, 6);

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" /> Activity Feed
        </CardTitle>
        <CardDescription>Course / Topic / ILO changes from the last 30 days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {top.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No activity yet. Make an edit to see it here.
          </p>
        ) : (
          top.map((a) => (
            <ActivityRow
              key={a.id}
              entry={a}
              currentUserId={currentUserId}
              courses={courses}
              topics={topics}
              ilos={ilos}
            />
          ))
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setOpen(true)}
          disabled={recent.length === 0}
        >
          View all
        </Button>
      </CardContent>
      <ActivityFeedDialog
        open={open}
        onOpenChange={setOpen}
        entries={recent}
        currentUserId={currentUserId}
        courses={courses}
        topics={topics}
        ilos={ilos}
      />
    </Card>
  );
}

import { useNavigate } from "@tanstack/react-router";

export function ActivityRow({
  entry,
  currentUserId,
  courses,
  topics,
  ilos
}: {
  entry: ActivityEntry;
  currentUserId: string | null;
  courses: Course[];
  topics: Topic[];
  ilos: ILO[];
}) {
  const Icon = ICONS[entry.entity];
  const isCurrentUser = entry.userId === currentUserId;
  const navigate = useNavigate();

  const path = useMemo(() => {
    if (entry.entity === "ILO") return getIloPath(entry.entityId, courses, topics, ilos);
    if (entry.entity === "topic") return getTopicPath(entry.entityId, courses, topics);
    return "";
  }, [entry, courses, topics, ilos]);

  return (
    <div
      className="flex items-start gap-3 rounded-md border border-border/60 bg-background/30 px-3 py-2 cursor-pointer hover:bg-background/50 hover:border-primary/30 transition-colors group"
      onClick={() => navigate({ to: "/dashboard", search: { focus: entry.entityId } })}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/30 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col">
          {path && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-semibold mb-0.5">
              {path}
            </span>
          )}
          <p className="text-xs">
            {entry.action === "updated" && entry.newLabel ? (
              <>
                <span className="font-medium capitalize">{entry.entity}</span>{" "}
                <span className="text-muted-foreground">updated:</span>{" "}
                <span className="font-medium">{entry.label}</span>{" "}
                <span className="text-muted-foreground">to</span>{" "}
                <span className="font-medium">{entry.newLabel}</span>
              </>
            ) : (
              <>
                <span className="font-medium capitalize">{entry.entity}</span>{" "}
                <span className="text-muted-foreground">{entry.action}:</span>{" "}
                <span className="font-medium">{entry.label}</span>
              </>
            )}
          </p>
        </div>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
          {entry.userName && (
            <span>
              {entry.userName}
              {isCurrentUser && " (You)"}
            </span>
          )}
          {entry.userName && <span>·</span>}
          <span>{relativeTime(entry.timestamp)}</span>
        </p>
      </div>
    </div>
  );
}
