import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
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
import { useClassStore } from "@/lib/stores/classStore";

export function EnrollClassDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { enrollClassByCode } = useClassStore();
  const [code, setCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const navigate = useNavigate();

  const handleEnroll = async () => {
    if (code.trim().length !== 8) {
      toast.error("Enter the full 8-character class code.");
      return;
    }
    setEnrolling(true);
    try {
      const cls = await enrollClassByCode(code);
      if (!cls) {
        toast.error("No class found for that code.");
        return;
      }
      toast.success(`Enrolled in ${cls.courseDisplay}`);
      setCode("");
      onOpenChange(false);
      navigate({ to: "/student/home" });
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Enroll in a class</DialogTitle>
          <DialogDescription>Ask your faculty for the 8-character class code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="enroll-code">Class code</Label>
          <Input
            id="enroll-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="87NUM8QU"
            maxLength={8}
            className="text-center font-mono text-lg tracking-[0.3em]"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleEnroll} disabled={enrolling}>
            {enrolling ? "Enrolling..." : "Enroll in a class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
