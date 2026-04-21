import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClassStore } from "@/lib/classStore";

export function CreateSessionForm({ classId }: { classId: string }) {
  const { createSession } = useClassStore();
  const [topic, setTopic] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const handleStart = () => {
    if (!topic.trim()) {
      toast.error("Enter a topic for this collection.");
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
    const s = createSession({ classId, topic, startsAt, endsAt });
    toast.success(`Collection started: ${s.topic}`);
    setTopic("");
    setStartsAt("");
    setEndsAt("");
  };

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="h-4 w-4 text-primary" /> Start feedback collection
        </CardTitle>
        <CardDescription>
          Schedule a window for students to submit anonymous feedback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Functions & Scope"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="starts">Starts</Label>
            <Input
              id="starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ends">Ends</Label>
            <Input
              id="ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleStart} className="w-full">
          Start collection
        </Button>
      </CardContent>
    </Card>
  );
}
