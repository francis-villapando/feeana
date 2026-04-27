import { useState } from "react";
import { useCourseStore } from "@/lib/courseStore";
import type { BloomLevel, Course, EntityKind, ILO, Topic } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type State =
  | { kind: "course"; entity?: Course }
  | { kind: "topic"; entity?: Topic }
  | { kind: "ILO"; entity?: ILO };

const BLOOMS: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

export function EntityFormDialog({ state, onClose }: { state: State; onClose: () => void }) {
  const { courses, topics, createCourse, updateCourse, createTopic, updateTopic, createILO, updateILO } =
    useCourseStore();

  const isEdit = !!state.entity;
  const labels: Record<EntityKind, string> = {
    course: "Course",
    topic: "Topic",
    ILO: "ILO",
  };

  // Course
  const [code, setCode] = useState(state.kind === "course" ? (state.entity?.code ?? "") : "");
  const [title, setTitle] = useState(state.kind === "course" ? (state.entity?.title ?? "") : "");
  // Topic
  const [topicTitle, setTopicTitle] = useState(
    state.kind === "topic" ? (state.entity?.title ?? "") : "",
  );
  const [topicCourseId, setTopicCourseId] = useState(
    state.kind === "topic"
      ? (state.entity?.courseId ?? courses[0]?.id ?? "")
      : (courses[0]?.id ?? ""),
  );
  // ILO
  const [iloStatement, setIloStatement] = useState(
    state.kind === "ILO" ? (state.entity?.statement ?? "") : "",
  );
  const [iloCourseId, setIloCourseId] = useState(
    state.kind === "ILO"
      ? (state.entity?.courseId ?? courses[0]?.id ?? "")
      : (courses[0]?.id ?? ""),
  );
  const [iloTopicId, setIloTopicId] = useState(
    state.kind === "ILO" ? (state.entity?.topicId ?? "") : "",
  );
  const [iloBloom, setIloBloom] = useState<BloomLevel>(
    state.kind === "ILO" ? (state.entity?.bloomLevel ?? "Remember") : "Remember",
  );

  const availableTopics = topics.filter(
    (t) => t.courseId === iloCourseId && !t.archived,
  );

  const handleSave = () => {
    try {
      if (state.kind === "course") {
        if (!code.trim() || !title.trim()) {
          toast.error("Code and title required.");
          return;
        }
        if (state.entity) {
          updateCourse(state.entity.id, { code, title });
          toast.success("Course updated.");
        } else {
          createCourse({ code, title });
          toast.success("Course created.");
        }
      } else if (state.kind === "topic") {
        if (!topicTitle.trim() || !topicCourseId) {
          toast.error("Title and course required.");
          return;
        }
        if (state.entity) {
          updateTopic(state.entity.id, {
            courseId: topicCourseId,
            title: topicTitle,
          });
          toast.success("Topic updated.");
        } else {
          createTopic({ courseId: topicCourseId, title: topicTitle });
          toast.success("Topic created.");
        }
      } else {
        if (!iloStatement.trim() || !iloCourseId || !iloTopicId) {
          toast.error("Course, topic, and statement required.");
          return;
        }
        if (state.entity) {
          updateILO(state.entity.id, {
            courseId: iloCourseId,
            topicId: iloTopicId,
            statement: iloStatement,
            bloomLevel: iloBloom,
          });
          toast.success("ILO updated.");
        } else {
          createILO({
            courseId: iloCourseId,
            topicId: iloTopicId,
            statement: iloStatement,
            bloomLevel: iloBloom,
          });
          toast.success("ILO created.");
        }
      }
      onClose();
    } catch {
      toast.error("Could not save.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "Add"} {labels[state.kind]}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the fields below." : "Fill in the details."}
          </DialogDescription>
        </DialogHeader>

        {state.kind === "course" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="course-code">Code</Label>
              <Input
                id="course-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CSEG2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-title">Description</Label>
              <Input
                id="course-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Game Programming 1"
              />
            </div>
          </div>
        )}

        {state.kind === "topic" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Course</Label>
              <Select value={topicCourseId} onValueChange={setTopicCourseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courses
                    .filter((c) => !c.archived)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-title">Title</Label>
              <Input
                id="topic-title"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                placeholder="Recursion"
              />
            </div>
          </div>
        )}

        {state.kind === "ILO" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Course</Label>
              <Select
                value={iloCourseId}
                onValueChange={(v) => {
                  setIloCourseId(v);
                  setIloTopicId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courses
                    .filter((c) => !c.archived)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Select
                value={iloTopicId}
                onValueChange={setIloTopicId}
                disabled={!iloCourseId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !iloCourseId
                        ? "Select a course first"
                        : availableTopics.length === 0
                        ? "No topics for this course"
                        : "Select a topic"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableTopics.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No topics for this course — add one first.
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
              <Label>Bloom level</Label>
              <Select value={iloBloom} onValueChange={(v) => setIloBloom(v as BloomLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOOMS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ilo-stmt">Statement</Label>
              <Textarea
                id="ilo-stmt"
                value={iloStatement}
                onChange={(e) => setIloStatement(e.target.value)}
                placeholder="Apply…"
                className="min-h-[100px]"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{isEdit ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
