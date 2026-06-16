import { createFileRoute } from "@tanstack/react-router";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClassStore } from "@/lib/stores/classStore";

import { ConfirmationDialog } from "@/components/faculty";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_faculty/archived")({
  head: () => ({
    meta: [
      { title: "Archived classes — Feeana" },
      {
        name: "description",
        content: "Browse archived classes and restore them when needed.",
      },
    ],
  }),
  component: ArchivedPage,
});

function ArchivedPage() {
  const { archivedClasses, restoreClass, deleteClass } = useClassStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteClass(deletingId);
      setDeletingId(null);
      toast.success("Class deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete class");
    }
  };

  const handleRestore = async () => {
    if (!restoringId) return;
    try {
      await restoreClass(restoringId);
      setRestoringId(null);
      toast.success("Class restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore class");
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Archive className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Archived classes</h1>
          <p className="text-sm text-muted-foreground">Manage your inactive classes.</p>
        </div>
      </div>

      {archivedClasses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
          <Archive className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold">Nothing archived</h3>
          <p className="mt-1 text-sm text-muted-foreground">Archived classes will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {archivedClasses.map((cls) => (
            <Card key={cls.id} className="border-border/60 bg-card/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-base">{cls.courseCode}</CardTitle>
                <CardDescription>
                  {cls.courseDisplay} · Section {cls.section}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Code </span>
                  <span className="font-mono tracking-wider">{cls.enrollCode}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setRestoringId(cls.id)}
                  >
                    <RotateCcw className="h-4 w-4" /> Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingId(cls.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmationDialog
        isOpen={!!restoringId}
        onClose={() => setRestoringId(null)}
        onConfirm={handleRestore}
        title="Restore class"
        description={`Restore the "${archivedClasses.find(cls => cls.id === restoringId)?.courseCode}" class? This will move it back to your active dashboard.`}
        actionType="restore"
      />

      <ConfirmationDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete class"
        description={`Delete the "${archivedClasses.find(cls => cls.id === deletingId)?.courseCode}" class? This will delete all sessions and feedback associated with this class. This action cannot be undone.`}
        actionType="delete"
      />
    </div>
  );
}
