import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActivityEntry, Course, ILO, Topic } from "@/lib/types/types";
import { ActivityRow } from "./ActivityFeed";

export function ActivityFeedDialog({
  open,
  onOpenChange,
  entries,
  currentUserId,
  courses,
  topics,
  ilos,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entries: ActivityEntry[];
  currentUserId: string | null;
  courses: Course[];
  topics: Topic[];
  ilos: ILO[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Activity — last 30 days</DialogTitle>
          <DialogDescription>Every course, topic, and ILO change.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-2">
            {entries.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Nothing in the last 30 days.
              </p>
            )}
            {entries.map((e) => (
              <ActivityRow 
                key={e.id} 
                entry={e} 
                currentUserId={currentUserId} 
                courses={courses}
                topics={topics}
                ilos={ilos}
              />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
