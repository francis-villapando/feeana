import { useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClassStore } from "@/lib/stores/classStore";
import { useCourseStore } from "@/lib/stores/courseStore";
import { InlineError, destructiveBorder } from "@/components/common";
import { friendlyError } from "@/lib/hooks/utils";
import { useTutorialStore } from "@/lib/tutorial/tutorialStore";

export function CreateClassDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { createClass } = useClassStore();
  const { courses } = useCourseStore();
  const {
    isActive: tutorialActive,
    step: tutorialStep,
    activeCourseId: tutorialCourseId,
    advanceIfStep,
    setActiveClassId,
  } = useTutorialStore();

  const [courseId, setCourseId] = useState("");
  const [section, setSection] = useState("");
  const [courseError, setCourseError] = useState("");
  const [sectionError, setSectionError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedCourse = courses.find((crs) => crs.id === courseId);

  // During the tour's class-form step, show all courses but disable non-tutorial ones.
  const tutorialClassForm = tutorialActive && tutorialStep?.id === "step-create-class-form";
  const availableCourses = courses.filter((crs) => !crs.archived);

  const handleCreate = async () => {
    setCourseError("");
    setSectionError("");
    setSubmitError("");

    let hasError = false;
    if (!courseId) {
      setCourseError("Course is required.");
      hasError = true;
    }
    if (tutorialClassForm && tutorialCourseId && courseId !== tutorialCourseId) {
      setCourseError("Select the course you just created.");
      hasError = true;
    }
    if (!section.trim()) {
      setSectionError("Section is required.");
      hasError = true;
    }
    if (hasError) return;

    setCreating(true);
    try {
      const cls = await createClass({
        courseId,
        courseCode: selectedCourse?.code ?? "",
        courseTitle: selectedCourse?.title ?? "",
        section: section.trim(),
        isTutorial: tutorialActive && tutorialStep?.id === "step-create-class-form",
      });
      toast.success(`Class created. Enroll code: ${cls.enrollCode}`);
      if (tutorialActive) {
        setActiveClassId(cls.id);
      }
      setCourseId("");
      setSection("");
      onOpenChange(false);
      if (tutorialActive && tutorialStep) {
        advanceIfStep(tutorialStep.id);
      }
    } catch (err) {
      setSubmitError(friendlyError(err, "Failed to create class"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (!v && tutorialClassForm ? undefined : onOpenChange(v))}
    >
      <DialogContent
        data-tutorial="create-class-dialog-content"
        onPointerDownOutside={(e) => tutorialClassForm && e.preventDefault()}
        onEscapeKeyDown={(e) => tutorialClassForm && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create a class</DialogTitle>
          <DialogDescription>
            An 8-character enroll code is generated automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="class-course">Course</Label>
            <Select
              value={courseId}
              onValueChange={(v) => {
                setCourseId(v);
                setCourseError("");
              }}
            >
              <SelectTrigger id="class-course" className={courseError ? destructiveBorder : ""}>
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {availableCourses.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No courses yet — add one in Dashboard → Course Management Hub.
                  </div>
                ) : (
                  availableCourses.map((crs) => (
                    <SelectItem
                      key={crs.id}
                      value={crs.id}
                      disabled={tutorialClassForm && crs.id !== tutorialCourseId}
                    >
                      {crs.code} — {crs.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <InlineError errorMessage={courseError} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-section">Section</Label>
            <Input
              id="class-section"
              value={section}
              onChange={(e) => {
                setSection(e.target.value.toUpperCase());
                setSectionError("");
              }}
              placeholder="e.g. 1CS-A, 2CS-B"
              className={sectionError ? destructiveBorder : ""}
            />
            <InlineError errorMessage={sectionError} />
          </div>
          <InlineError errorMessage={submitError} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={tutorialClassForm}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
