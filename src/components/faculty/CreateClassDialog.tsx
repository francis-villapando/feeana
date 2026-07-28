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

export function CreateClassDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { createClass } = useClassStore();
  const { courses } = useCourseStore();
  const [courseId, setCourseId] = useState("");
  const [section, setSection] = useState("");
  const [courseError, setCourseError] = useState("");
  const [sectionError, setSectionError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const selectedCourse = courses.find((crs) => crs.id === courseId);

  const handleCreate = async () => {
    setCourseError("");
    setSectionError("");
    setSubmitError("");

    let hasError = false;
    if (!courseId) {
      setCourseError("Course is required.");
      hasError = true;
    }
    if (!section.trim()) {
      setSectionError("Section is required.");
      hasError = true;
    }
    if (hasError) return;

    try {
      const cls = await createClass({
        courseId,
        courseCode: selectedCourse?.code ?? "",
        courseTitle: selectedCourse?.title ?? "",
        section: section.trim(),
      });
      toast.success(`Class created. Enroll code: ${cls.enrollCode}`);
      setCourseId("");
      setSection("");
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create class");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a class</DialogTitle>
          <DialogDescription>A 6-character enroll code is generated automatically.</DialogDescription>
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
                {courses.filter((crs) => !crs.archived).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No courses yet — add one in Dashboard → Course Management Hub.
                  </div>
                ) : (
                  courses
                    .filter((crs) => !crs.archived)
                    .map((crs) => (
                      <SelectItem key={crs.id} value={crs.id}>
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
                setSection(e.target.value);
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create class</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
