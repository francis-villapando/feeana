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
import { useClassStore } from "@/lib/classStore";

export function JoinClassDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { joinClassByCode } = useClassStore();
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    if (code.trim().length !== 6) {
      toast.error("Enter the full 6-character class code.");
      return;
    }
    const cls = joinClassByCode(code);
    if (!cls) {
      toast.error("No class found for that code.");
      return;
    }
    toast.success(`Joined ${cls.course} · ${cls.section}`);
    setCode("");
    onOpenChange(false);
    navigate({ to: "/student/home" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Join a class</DialogTitle>
          <DialogDescription>Ask your faculty for the 6-character class code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="join-code">Class code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="7K2P9X"
            maxLength={6}
            className="text-center font-mono text-lg tracking-[0.4em]"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleJoin}>Join class</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
