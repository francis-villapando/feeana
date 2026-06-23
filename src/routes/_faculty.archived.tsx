import { createFileRoute } from "@tanstack/react-router";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { useClassStore } from "@/lib/stores/classStore";

import { ClassCard } from "@/components/faculty/ClassCard";
import { ConfirmationDialog } from "@/components/faculty";
import { useState } from "react";

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
    <div className="space-y-10">
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
            <ClassCard
              key={cls.id}
              cls={cls}
              onRestore={(id) => setRestoringId(id)}
              onDelete={(id) => setDeletingId(id)}
            />
          ))}
        </div>
      )}

      <ConfirmationDialog
        isOpen={!!restoringId}
        onClose={() => setRestoringId(null)}
        onConfirm={handleRestore}
        title="Restore class"
        description={`Restore the "${archivedClasses.find(cls => cls.id === restoringId)?.courseCode} · ${archivedClasses.find(cls => cls.id === restoringId)?.section}" class? This will move it back to your active dashboard.`}
        actionType="restore"
      />

      <ConfirmationDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete class"
        description={`Delete the "${archivedClasses.find(cls => cls.id === deletingId)?.courseCode} · ${archivedClasses.find(cls => cls.id === deletingId)?.section}" class? This will delete all sessions and feedback associated with this class. This action cannot be undone.`}
        actionType="delete"
      />
    </div>
  );
}
