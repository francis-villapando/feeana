import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassInfoDialog } from "@/components/ClassInfoDialog";
import { EnrollClassDialog } from "@/components/EnrollClassDialog";
import { WelcomeHero } from "@/components/WelcomeHero";
import { useAuth } from "@/lib/auth";
import { useClassStore } from "@/lib/classStore";
import type { Class } from "@/lib/types";
import { SessionCard } from "@/components/dashboard/SessionCard";

export const Route = createFileRoute("/_student/student/home")({
  head: () => ({
    meta: [
      { title: "Student home — Feeana" },
      {
        name: "description",
        content: "Active sessions from your enrolled classes.",
      },
    ],
  }),
  component: StudentHome,
});

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero Section Skeleton */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/10 bg-card/40 p-8 backdrop-blur-xl">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-6 w-48 rounded-full" />
            <Skeleton className="h-10 w-64 sm:h-12 sm:w-80" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <Skeleton className="h-12 w-full sm:w-44" />
        </div>
      </section>

      {/* Class Groups Skeletons */}
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <section key={i} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-2">
              {[1, 2].map((j) => (
                <Card key={j} className="border-border/40 bg-card/40">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-10 w-full sm:w-36" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function StudentHome() {
  const { enrolledClassIds, classes, sessions, isLoading } = useClassStore();
  const { user } = useAuth();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [classInfo, setClassInfo] = useState<Class | null>(null);

  const enrolled = classes.filter((c) => enrolledClassIds.includes(c.id));
  const classesWithSessions = enrolled.map((c) => ({
    cls: c,
    sessions: sessions.filter((s) => s.classId === c.id && s.status === "active"),
  }));

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <WelcomeHero
        badge={`Welcome${user ? `, ${user.name}` : ""}`}
        title="Active sessions"
        description="Pick an open session from any class you've enrolled in. Taglish is welcome."
        actions={[
          {
            label: "Enroll in a class",
            icon: <BookOpenCheck className="h-4 w-4" />,
            onClick: () => setEnrollOpen(true),
          },
        ]}
        inline
      />

      {enrolled.length === 0 ? (
        <EmptyEnroll onEnroll={() => setEnrollOpen(true)} />
      ) : (
        <div className="space-y-6">
          {classesWithSessions.map((group) => (
            <section key={group.cls.id} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <button
                  type="button"
                  onClick={() => setClassInfo(group.cls)}
                  className="text-sm font-semibold tracking-wider text-primary hover:underline cursor-pointer"
                >
                  {group.cls.course}
                </button>
              </div>
              {group.sessions.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-card/40">
                  <CardContent className="px-6 py-8 text-center">
                    <h3 className="text-sm font-medium">No active sessions</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Check back later — your faculty hasn't opened a session yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {group.sessions.map((s) => (
                    <SessionCard key={s.id} session={s} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <EnrollClassDialog open={enrollOpen} onOpenChange={setEnrollOpen} />

      {classInfo && user && (
        <ClassInfoDialog
          open={classInfo !== null}
          onOpenChange={(open) => { if (!open) setClassInfo(null); }}
          cls={classInfo}
          studentId={user.id}
        />
      )}
    </div>
  );
}

function EmptyEnroll({ onEnroll }: { onEnroll: () => void }) {
  return (
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardContent className="px-6 py-16 text-center">
        <BookOpenCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 text-base font-semibold">You haven't enrolled in any classes yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask your faculty for the 8-character class code.
        </p>
        <Button className="mt-4" onClick={onEnroll}>
          <BookOpenCheck className="h-4 w-4" /> Enroll in a class
        </Button>
      </CardContent>
    </Card>
  );
}
