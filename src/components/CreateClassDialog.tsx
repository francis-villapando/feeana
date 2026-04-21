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
import { useClassStore } from "@/lib/classStore";

export function CreateClassDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { createClass } = useClassStore();
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");

  const handleCreate = () => {
    if (!name.trim() || !course.trim() || !section.trim()) {
      toast.error("Class name, course, and section are required.");
      return;
    }
    const cls = createClass({ name, course, section });
    toast.success(`Class created. Join code: ${cls.code}`);
    setName("");
    setCourse("");
    setSection("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a class</DialogTitle>
          <DialogDescription>
            A 6-character join code is generated automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="class-name">Class name</Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Intro to Programming"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="class-course">Course</Label>
              <Input
                id="class-course"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="CS 101"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-section">Section</Label>
              <Input
                id="class-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A"
              />
            </div>
          </div>
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
