import { useState } from "react";
import { Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClassStore } from "@/lib/classStore";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { classParticipation } from "@/lib/metrics";

export function ClassStudentsTab({ classId }: { classId: string }) {
  const { studentsForClass, removeStudent, getClass, sessionsForClass } = useClassStore();
  const { feedback } = useFeedbackStore();
  const students = studentsForClass(classId);
  const cls = getClass(classId);
  const sessions = sessionsForClass(classId);
  const participation = cls ? classParticipation(cls, sessions, feedback) : 0;
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null);

  if (!cls) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/60 bg-card/70 backdrop-blur-xl">
        {students.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No students in this class yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {s.email}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {new Date(s.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPending({ id: s.id, name: s.name })}
                      aria-label={`Remove ${s.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Participation: {participation}%</span> —
        anonymous; never tied to individual names.
      </p>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pending?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this class. Their previously submitted anonymous feedback
              stays unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) {
                  removeStudent(classId, pending.id);
                  toast.success(`${pending.name} removed.`);
                  setPending(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
