import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, LayoutDashboard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeHero } from "@/components/common";
import { ClassCard, CreateClassDialog } from "@/components/faculty";
import { useClassStore } from "@/lib/classStore";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_faculty/home")({
  head: () => ({
    meta: [
      { title: "Home — Feeana" },
      {
        name: "description",
        content:
          "Your Feeana workspace: create classes and run outcome-aligned sessions.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { activeClasses, isLoading } = useClassStore();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-10">
      <WelcomeHero
        badge={`Welcome${user ? `, ${user.name}` : ""}`}
        title="Your feedback intelligence workspace."
        description="Spin up classes, schedule anonymous feedback sessions, and let Feeana surface ILO-aligned teaching cues from Taglish responses."
        actions={[
          {
            label: "Create class",
            icon: <Plus className="h-4 w-4" />,
            onClick: () => setCreateOpen(true),
          },
          {
            label: "View dashboard",
            icon: <LayoutDashboard className="h-4 w-4" />,
            variant: "outline",
            href: "/dashboard",
          },
        ]}
        inline
      />

      {/* Classes */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Your classes</h2>
            <p className="text-sm text-muted-foreground">
              Open a class to manage sessions and view trends.
            </p>
          </div>
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : activeClasses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
            <h3 className="text-base font-semibold">No classes yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first class to start running sessions.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create class
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeClasses.map((c) => (
              <ClassCard key={c.id} cls={c} />
            ))}
          </div>
        )}
      </section>

      <CreateClassDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  );
}
