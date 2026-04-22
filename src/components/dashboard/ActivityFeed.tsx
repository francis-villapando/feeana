import { useMemo, useState } from "react";
import { Activity, BookOpen, ListChecks, Target } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCourseStore } from "@/lib/courseStore";
import type { ActivityEntry, EntityKind } from "@/lib/types";
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
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ActivityFeed() {
  const { activity } = useCourseStore();
  const [open, setOpen] = useState(false);

  const recent = useMemo(
    () => activity.filter((a) => withinDays(a.timestamp, 30)),
    [activity],
  );
  const top = recent.slice(0, 6);

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" /> Activity feed
        </CardTitle>
        <CardDescription>
          Course / topic / ILO changes from the last 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {top.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No activity yet. Make an edit to see it here.
          </p>
        ) : (
          top.map((a) => <ActivityRow key={a.id} entry={a} />)
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
      <ActivityFeedDialog open={open} onOpenChange={setOpen} entries={recent} />
    </Card>
  );
}

export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const Icon = ICONS[entry.entity];
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/60 bg-background/30 px-3 py-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/30">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-medium capitalize">{entry.entity}</span>{" "}
          <span className="text-muted-foreground">{entry.action}</span>{" "}
          <span className="font-medium">— {entry.label}</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          {relativeTime(entry.timestamp)}
        </p>
      </div>
    </div>
  );
}
