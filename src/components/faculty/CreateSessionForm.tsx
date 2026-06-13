import { useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/faculty";
import { useClassStore } from "@/lib/classStore";
import { useCourseStore } from "@/lib/courseStore";
import { topicsForClass } from "@/lib/courseLookup";

export function SessionCreator({ classId }: { classId: string }) {
  const { createSession, getClass } = useClassStore();
  const { courses, topics } = useCourseStore();
  const cls = getClass(classId);

  const availableTopics = useMemo(
    () => topicsForClass(cls, courses, topics),
    [cls, courses, topics],
  );

  const [topicId, setTopicId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const handleStart = async () => {
    const topic = availableTopics.find((t) => t.id === topicId);
    if (!topic) {
      toast.error("Pick a topic for this session.");
      return;
    }
    if (!startsAt || !endsAt) {
      toast.error("Pick a start and end date/time.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      toast.error("End must be after start.");
      return;
    }
    try {
      const s = await createSession({
        classId,
        topic: topic.title,
        topicId: topic.id,
        courseId: topic.courseId,
        startsAt,
        endsAt,
      });
      toast.success(`Session started: ${s.topic}`);
      setTopicId("");
      setStartsAt("");
      setEndsAt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start session");
    }
  };

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="h-4 w-4 text-primary" /> Start session
        </CardTitle>
        <CardDescription>
          Schedule a window for students to submit anonymous feedback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="topic">Topic</Label>
          <Select value={topicId} onValueChange={setTopicId}>
            <SelectTrigger id="topic">
              <SelectValue
                placeholder={
                  availableTopics.length === 0 ? "No topics for this course" : "Select a topic"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableTopics.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No topics for this course — add one in Dashboard → Course Management Hub.
                </div>
              ) : (
                availableTopics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Starts</Label>
          <DateTimePicker value={startsAt} onChange={setStartsAt} />
        </div>
        <div className="space-y-1.5">
          <Label>Ends</Label>
          <DateTimePicker value={endsAt} onChange={setEndsAt} />
        </div>
        <Button onClick={handleStart} className="w-full">
          Start session
        </Button>
      </CardContent>
    </Card>
  );
}
