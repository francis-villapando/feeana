import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, LayoutDashboard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WelcomeHero } from "@/components/common";
import { ClassCard, CreateClassDialog } from "@/components/faculty";
import { ClassCardSkeleton } from "@/components/skeletons";
import { useClassStore } from "@/lib/stores/classStore";
import { useAuth } from "@/lib/stores/auth";

export const Route = createFileRoute("/_faculty/home")({
  head: () => ({
    meta: [
      { title: "Home — Feeana" },
      {
        name: "description",
        content: "Your Feeana workspace: create classes and run outcome-aligned sessions.",
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
              <ClassCardSkeleton key={i} />
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
            {activeClasses.map((cls) => (
              <ClassCard key={cls.id} cls={cls} />
            ))}
          </div>
        )}
      </section>

      <CreateClassDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
