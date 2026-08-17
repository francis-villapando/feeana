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
import { useClassStore } from "@/lib/stores/classStore";
import { useCourseStore } from "@/lib/stores/courseStore";
import { topicsForClass } from "@/lib/hooks/courseLookup";
import { InlineError, destructiveBorder } from "@/components/common";
import { friendlyError } from "@/lib/hooks/utils";

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
  const [topicError, setTopicError] = useState("");
  const [startsAtError, setStartsAtError] = useState("");
  const [endsAtError, setEndsAtError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setTopicError("");
    setStartsAtError("");
    setEndsAtError("");
    setSubmitError("");

    const topic = availableTopics.find((t) => t.id === topicId);
    if (!topic) setTopicError("Pick a topic for this session.");
    if (!startsAt) setStartsAtError("Pick a start date/time.");
    if (!endsAt) setEndsAtError("Pick an end date/time.");
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt))
      setEndsAtError("End must be after start.");
    if (endsAt && new Date(endsAt) <= new Date()) setEndsAtError("End time cannot be in the past.");

    const hasError =
      !topic ||
      !startsAt ||
      !endsAt ||
      (startsAt !== "" && endsAt !== "" && new Date(endsAt) <= new Date(startsAt)) ||
      (endsAt !== "" && new Date(endsAt) <= new Date());
    if (hasError) return;

    setStarting(true);
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
      setSubmitError(friendlyError(err));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="h-4 w-4 text-primary" /> Session creator
        </CardTitle>
        <CardDescription>
          Schedule a window for students to submit anonymous feedback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="topic">Topic</Label>
          <Select
            value={topicId}
            onValueChange={(v) => {
              setTopicId(v);
              setTopicError("");
            }}
          >
            <SelectTrigger id="topic" className={topicError ? destructiveBorder : ""}>
              <SelectValue
                placeholder={
                  availableTopics.length === 0 ? "No topics for this course" : "Select a topic"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableTopics.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No topics for this course — add one in Dashboard → course management hub.
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
          <InlineError errorMessage={topicError} />
        </div>
        <div className="space-y-1.5">
          <Label>Starts</Label>
          <DateTimePicker
            value={startsAt}
            onChange={(v) => {
              setStartsAt(v);
              setStartsAtError("");
            }}
            className={startsAtError ? destructiveBorder : ""}
          />
          <InlineError errorMessage={startsAtError} />
        </div>
        <div className="space-y-1.5">
          <Label>Ends</Label>
          <DateTimePicker
            value={endsAt}
            onChange={(v) => {
              setEndsAt(v);
              setEndsAtError("");
            }}
            className={endsAtError ? destructiveBorder : ""}
          />
          <InlineError errorMessage={endsAtError} />
        </div>
        <InlineError errorMessage={submitError} />
        <Button onClick={handleStart} className="w-full" disabled={starting}>
          {starting ? "Starting…" : "Start session"}
        </Button>
      </CardContent>
    </Card>
  );
}
