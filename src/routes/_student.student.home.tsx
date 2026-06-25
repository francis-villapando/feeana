import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpenCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeHero } from "@/components/common";
import { ClassInfoDialog, EnrollClassDialog, ActiveSessionAccordion, SubmitFeedbackDialog } from "@/components/student";
import { useAuth } from "@/lib/stores/auth";
import { useClassStore } from "@/lib/stores/classStore";
import { getSessionById } from "@/lib/services/classService";
import { computeSessionDisplayStatus } from "@/lib/utils/sessionStatusUtils";
import type { Class, Session } from "@/lib/types/types";

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

      {/* Accordion Skeletons */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="border border-border/60 rounded-lg bg-background/40 px-1"
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-4 shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentHome() {
  const { enrolledClassIds, classes, sessions, isLoading, submittedSessionIds, refreshEnrolledClasses, refreshSessions } = useClassStore();
  const { user } = useAuth();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [submitSession, setSubmitSession] = useState<Session | null>(null);
  const [verifyingSessionId, setVerifyingSessionId] = useState<string | null>(null);

  const handleSubmitSession = async (session: Session) => {
    setVerifyingSessionId(session.id);
    try {
      const fresh = await getSessionById(session.id);
      if (fresh && (fresh.status !== "active" || computeSessionDisplayStatus(fresh) !== "active")) {
        toast.error("This session has ended. Feedback is no longer being accepted.");
        await Promise.all([refreshEnrolledClasses(), refreshSessions(session.classId)]);
        return;
      }
      setSubmitSession(session);
    } catch {
      toast.error("Failed to verify session. Please try again.");
    } finally {
      setVerifyingSessionId(null);
    }
  };

  const enrolled = classes.filter((cls) => enrolledClassIds.includes(cls.id));

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
        <ActiveSessionAccordion
          classes={enrolled}
          sessions={sessions}
          submittedSessionIds={submittedSessionIds}
          onClassInfoClick={(cls) => setClassInfo(cls)}
          onSubmitSession={handleSubmitSession}
          verifyingSessionId={verifyingSessionId}
        />
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

      <SubmitFeedbackDialog
        session={submitSession}
        open={submitSession !== null}
        onOpenChange={(open) => { if (!open) setSubmitSession(null); }}
      />
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
