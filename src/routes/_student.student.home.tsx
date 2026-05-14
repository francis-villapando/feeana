import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, BookOpenCheck, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EnrollClassDialog } from "@/components/EnrollClassDialog";
import { useClassStore } from "@/lib/classStore";

export const Route = createFileRoute("/_student/student/home")({
  head: () => ({
    meta: [
      { title: "Student home — Feeana" },
      {
        name: "description",
        content: "Active feedback collections from your enrolled classes.",
      },
    ],
  }),
  component: StudentHome,
});

function formatDT(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StudentHome() {
  const { enrolledClassIds, classes, sessions } = useClassStore();
  const [enrollOpen, setEnrollOpen] = useState(false);

  const enrolled = classes.filter((c) => enrolledClassIds.includes(c.id));
  const activeByClass = enrolled
    .map((c) => ({
      cls: c,
      sessions: sessions.filter((s) => s.classId === c.id && s.status === "active"),
    }))
    .filter((g) => g.sessions.length > 0);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/70 to-card/40 p-8 backdrop-blur-xl">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Your voice, anonymized
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Active feedback collections
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Pick an open session from any class you've enrolled in. Taglish is welcome.
            </p>
          </div>
          <Button onClick={() => setEnrollOpen(true)} size="lg">
            <BookOpenCheck className="h-4 w-4" /> Enroll in a class
          </Button>
        </div>
      </section>

      {enrolled.length === 0 ? (
        <EmptyEnroll onEnroll={() => setEnrollOpen(true)} />
      ) : activeByClass.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40">
          <CardContent className="px-6 py-16 text-center">
            <h3 className="text-base font-semibold">No active collections right now</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back later — your faculty haven't opened a session yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeByClass.map((group) => (
            <section key={group.cls.id} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.cls.course} · {group.cls.section}
                </h2>
                <span className="text-xs text-muted-foreground">{group.cls.name}</span>
              </div>
              <div className="space-y-2">
                {group.sessions.map((s) => (
                  <Card
                    key={s.id}
                    className="border-border/60 bg-card/70 backdrop-blur-xl transition hover:border-primary/40"
                  >
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="font-medium">{s.topic}</h3>
                        <p className="text-xs text-muted-foreground">
                          {group.cls.course} · {group.cls.section}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDT(s.startsAt)} → {formatDT(s.endsAt)}
                        </p>
                      </div>
                      <Button asChild className="w-full sm:w-auto">
                        <Link to="/student/submit/$sessionId" params={{ sessionId: s.id }}>
                          Submit feedback <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EnrollClassDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
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
