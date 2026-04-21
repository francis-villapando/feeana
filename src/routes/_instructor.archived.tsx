import { createFileRoute } from "@tanstack/react-router";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClassStore } from "@/lib/classStore";

export const Route = createFileRoute("/_instructor/archived")({
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
  const { archivedClasses, restoreClass } = useClassStore();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Archive
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Archived classes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restore a class to bring it back into your active workspace.
        </p>
      </div>

      {archivedClasses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
          <Archive className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold">Nothing archived</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Archived classes will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {archivedClasses.map((c) => (
            <Card
              key={c.id}
              className="border-border/60 bg-card/70 backdrop-blur-xl"
            >
              <CardHeader>
                <CardTitle className="text-base">{c.name}</CardTitle>
                <CardDescription>
                  {c.course} · Section {c.section}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Code </span>
                  <span className="font-mono tracking-wider">{c.code}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    restoreClass(c.id);
                    toast.success("Class restored");
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Restore
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
