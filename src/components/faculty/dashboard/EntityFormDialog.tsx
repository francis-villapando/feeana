import { useState } from "react";
import { useCourseStore } from "@/lib/stores/courseStore";
import { ConflictError, DuplicateError } from "@/lib/services/courseService";
import type { BloomLevel, Course, EntityKind, ILO, Topic } from "@/lib/types/types";
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
import { InlineError, destructiveBorder } from "@/components/common";
import { friendlyError, unchangedFields, noChangesMessage } from "@/lib/hooks/utils";
import { useTutorialStore } from "@/lib/tutorial/tutorialStore";

type State =
  | {
      kind: "course";
      entity?: Course;
      courseCodePlaceholder?: string;
      isTutorial?: boolean;
    }
  | { kind: "topic"; entity?: Topic; initialCourseId?: string }
  | {
      kind: "ILO";
      entity?: ILO;
      initialCourseId?: string;
      initialTopicId?: string;
    };

const BLOOMS: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

export function EntityFormDialog({ state, onClose }: { state: State; onClose: () => void }) {
  const {
    courses,
    topics,
    createCourse,
    updateCourse,
    createTopic,
    updateTopic,
    createILO,
    updateILO,
    refreshAll,
  } = useCourseStore();

  const {
    isActive: tutorialActive,
    step: tutorialStep,
    advanceIfStep,
    setActiveCourseId,
    setActiveTopicId,
    setActiveIloId,
  } = useTutorialStore();

  const isEdit = !!state.entity;
  const labels: Record<EntityKind, string> = {
    course: "course",
    topic: "topic",
    ILO: "ILO",
  };

  const [code, setCode] = useState(state.kind === "course" ? (state.entity?.code ?? "") : "");
  const [title, setTitle] = useState(state.kind === "course" ? (state.entity?.title ?? "") : "");
  const [topicTitle, setTopicTitle] = useState(
    state.kind === "topic" ? (state.entity?.title ?? "") : "",
  );
  const [topicCourseId, setTopicCourseId] = useState(() => {
    if (state.kind === "topic") {
      return state.entity?.courseId ?? state.initialCourseId ?? courses[0]?.id ?? "";
    }
    return courses[0]?.id ?? "";
  });
  const [iloStatement, setIloStatement] = useState(
    state.kind === "ILO" ? (state.entity?.statement ?? "") : "",
  );
  const [iloCourseId, setIloCourseId] = useState(() => {
    if (state.kind === "ILO") {
      return state.entity?.courseId ?? state.initialCourseId ?? courses[0]?.id ?? "";
    }
    return courses[0]?.id ?? "";
  });
  const [iloTopicId, setIloTopicId] = useState(() => {
    if (state.kind === "ILO") {
      return state.entity?.topicId ?? state.initialTopicId ?? "";
    }
    return "";
  });
  const [iloBloom, setIloBloom] = useState<BloomLevel | "">(() => {
    if (state.kind === "ILO") return state.entity?.bloomLevel ?? "";
    return "";
  });

  const [saving, setSaving] = useState(false);

  const [codeError, setCodeError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [topicTitleError, setTopicTitleError] = useState("");
  const [topicCourseError, setTopicCourseError] = useState("");
  const [iloStatementError, setIloStatementError] = useState("");
  const [iloCourseError, setIloCourseError] = useState("");
  const [iloTopicError, setIloTopicError] = useState("");
  const [iloBloomError, setIloBloomError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const availableTopics = topics.filter((t) => t.courseId === iloCourseId && !t.archived);

  const clearErrors = () => {
    setCodeError("");
    setTitleError("");
    setTopicTitleError("");
    setTopicCourseError("");
    setIloStatementError("");
    setIloCourseError("");
    setIloTopicError("");
    setIloBloomError("");
    setSubmitError("");
  };

  const handleSave = async () => {
    clearErrors();

    if (state.kind === "course") {
      let hasError = false;
      if (!code.trim()) {
        setCodeError("Code is required.");
        hasError = true;
      }
      if (!title.trim()) {
        setTitleError("Title is required.");
        hasError = true;
      }
      if (hasError) return;
    } else if (state.kind === "topic") {
      if (!topicTitle.trim()) {
        setTopicTitleError("Title is required.");
        return;
      }
      if (!state.entity && !topicCourseId) {
        setTopicCourseError("Course is required.");
        return;
      }
    } else {
      let hasError = false;
      if (!iloStatement.trim()) {
        setIloStatementError("Statement is required.");
        hasError = true;
      }
      if (!iloBloom) {
        setIloBloomError("Bloom level is required.");
        hasError = true;
      }
      if (!state.entity) {
        if (!iloCourseId) {
          setIloCourseError("Course is required.");
          hasError = true;
        }
        if (!iloTopicId) {
          setIloTopicError("Topic is required.");
          hasError = true;
        }
      }
      if (hasError) return;
    }

    if (state.entity) {
      const fields =
        state.kind === "course"
          ? [
              { label: "code", oldValue: state.entity.code, newValue: code },
              { label: "title", oldValue: state.entity.title, newValue: title },
            ]
          : state.kind === "topic"
            ? [{ label: "title", oldValue: state.entity.title, newValue: topicTitle }]
            : [
                { label: "statement", oldValue: state.entity.statement, newValue: iloStatement },
                { label: "Bloom level", oldValue: state.entity.bloomLevel, newValue: iloBloom },
              ];
      const unchanged = unchangedFields(fields);
      if (unchanged.length === fields.length) {
        if (state.kind === "topic") {
          setTopicTitleError(noChangesMessage(unchanged));
        } else {
          setSubmitError(noChangesMessage(unchanged));
        }
        return;
      }
    }

    setSaving(true);
    try {
      if (state.kind === "course") {
        if (state.entity) {
          await updateCourse(state.entity.id, { code, title, version: state.entity.version });
          toast.success("Course updated.");
        } else {
          const isTutorial =
            tutorialActive && tutorialStep?.id === "step-course-form"
              ? true
              : (state.isTutorial ?? false);
          const newCourse = await createCourse({ code, title, isTutorial });
          toast.success("Course created.");
          if (tutorialActive) {
            setActiveCourseId(newCourse.id);
          }
        }
      } else if (state.kind === "topic") {
        if (state.entity) {
          await updateTopic(state.entity.id, { title: topicTitle, version: state.entity.version });
          toast.success("Topic updated.");
        } else {
          const newTopic = await createTopic({ courseId: topicCourseId, title: topicTitle });
          toast.success("Topic created.");
          if (tutorialActive) {
            setActiveTopicId(newTopic.id);
          }
        }
      } else if (state.entity) {
        await updateILO(state.entity.id, {
          statement: iloStatement,
          bloomLevel: iloBloom as BloomLevel,
          version: state.entity.version,
        });
        toast.success("ILO updated.");
      } else {
        const newIlo = await createILO({
          courseId: iloCourseId,
          topicId: iloTopicId,
          statement: iloStatement,
          bloomLevel: iloBloom as BloomLevel,
        });
        toast.success("ILO created.");
        if (tutorialActive) {
          setActiveIloId(newIlo.id);
        }
      }
      onClose();
      if (tutorialActive && tutorialStep) {
        advanceIfStep(tutorialStep.id);
      }
    } catch (err) {
      if (err instanceof DuplicateError) {
        if (state.kind === "course") {
          setCodeError(err.message);
        } else if (state.kind === "topic") {
          setTopicTitleError(err.message);
        } else {
          setIloStatementError(err.message);
        }
        refreshAll();
      } else if (err instanceof ConflictError) {
        toast.error(err.message);
        refreshAll();
        onClose();
      } else {
        setSubmitError(friendlyError(err, "Could not save."));
      }
    } finally {
      setSaving(false);
    }
  };

  const codeInputPlaceholder =
    state.kind === "course" ? (state.courseCodePlaceholder ?? "CSEG2") : "CSEG2";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-tutorial="entity-dialog-content">
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
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().trim());
                  setCodeError("");
                }}
                placeholder={codeInputPlaceholder}
                className={codeError ? destructiveBorder : ""}
              />
              <InlineError errorMessage={codeError} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-title">Title</Label>
              <Input
                id="course-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleError("");
                }}
                placeholder="Game Programming 1"
                className={titleError ? destructiveBorder : ""}
              />
              <InlineError errorMessage={titleError} />
            </div>
          </div>
        )}

        {state.kind === "topic" && (
          <div className="space-y-3">
            {!state.entity && !state.initialCourseId && (
              <div className="space-y-1.5">
                <Label>Course</Label>
                <Select
                  value={topicCourseId}
                  onValueChange={(v) => {
                    setTopicCourseId(v);
                    setTopicCourseError("");
                  }}
                >
                  <SelectTrigger className={topicCourseError ? destructiveBorder : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {courses
                      .filter((crs) => !crs.archived)
                      .map((crs) => (
                        <SelectItem key={crs.id} value={crs.id}>
                          {crs.code} — {crs.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <InlineError errorMessage={topicCourseError} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="topic-title">Title</Label>
              <Input
                id="topic-title"
                value={topicTitle}
                onChange={(e) => {
                  setTopicTitle(e.target.value);
                  setTopicTitleError("");
                }}
                placeholder="Recursion"
                className={topicTitleError ? destructiveBorder : ""}
              />
              <InlineError errorMessage={topicTitleError} />
            </div>
          </div>
        )}

        {state.kind === "ILO" && (
          <div className="space-y-3">
            {!state.entity && !state.initialCourseId && (
              <div className="space-y-1.5">
                <Label>Course</Label>
                <Select
                  value={iloCourseId}
                  onValueChange={(v) => {
                    setIloCourseId(v);
                    setIloTopicId("");
                    setIloCourseError("");
                  }}
                >
                  <SelectTrigger className={iloCourseError ? destructiveBorder : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {courses
                      .filter((crs) => !crs.archived)
                      .map((crs) => (
                        <SelectItem key={crs.id} value={crs.id}>
                          {crs.code} — {crs.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <InlineError errorMessage={iloCourseError} />
              </div>
            )}
            {!state.entity && !state.initialTopicId && (
              <div className="space-y-1.5">
                <Label>Topic</Label>
                <Select
                  value={iloTopicId}
                  onValueChange={(v) => {
                    setIloTopicId(v);
                    setIloTopicError("");
                  }}
                  disabled={!iloCourseId}
                >
                  <SelectTrigger className={iloTopicError ? destructiveBorder : ""}>
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
                <InlineError errorMessage={iloTopicError} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Bloom level</Label>
              <Select
                value={iloBloom}
                onValueChange={(v) => {
                  setIloBloom(v as BloomLevel);
                  setIloBloomError("");
                }}
              >
                <SelectTrigger className={iloBloomError ? destructiveBorder : ""}>
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOMS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InlineError errorMessage={iloBloomError} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ilo-stmt">Statement</Label>
              <Textarea
                id="ilo-stmt"
                value={iloStatement}
                onChange={(e) => {
                  setIloStatement(e.target.value);
                  setIloStatementError("");
                }}
                placeholder="Apply…"
                className={`min-h-[100px] ${iloStatementError ? destructiveBorder : ""}`}
              />
              <InlineError errorMessage={iloStatementError} />
            </div>
          </div>
        )}

        <InlineError errorMessage={submitError} />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
