import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { InfoDialog } from "@/components/InfoDialog";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { useClassStore } from "@/lib/classStore";
import { getSessionById } from "@/lib/services/classService";

export const Route = createFileRoute("/_student/student/submit/$sessionId")({
  loader: async ({ params }) => {
    const session = await getSessionById(params.sessionId);
    if (!session) throw notFound();
    return { session };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Submit feedback — ${loaderData.session.topic}`
          : "Submit feedback — Feeana",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Session not found</h1>
      <Button asChild variant="ghost" className="mt-4">
        <Link to="/student/home">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </Button>
    </div>
  ),
  component: SubmitPage,
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

function SubmitPage() {
  const { session } = Route.useLoaderData();
  const navigate = useNavigate();
  const { addFeedback } = useFeedbackStore();
  const { classes, refreshEnrolledClasses, refreshSessions } = useClassStore();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const isActive = session.status === "active";

  const cls = classes.find((c) => c.id === session.classId);

  useEffect(() => {
    if (!isActive) setSessionEnded(true);
  }, [isActive]);

  const goHome = async () => {
    await Promise.all([refreshEnrolledClasses(), refreshSessions(session.classId)]);
    navigate({ to: "/student/home" });
  };

  const handleSubmit = async () => {
    if (text.trim().length < 4) {
      toast.error("Feedback must be at least a few characters.");
      return;
    }

    const fresh = await getSessionById(session.id);
    if (fresh && fresh.status !== "active") {
      setSessionEnded(true);
      return;
    }

    setSubmitting(true);
    try {
      await addFeedback(session.id, text);
      toast.success("Salamat! Your feedback was recorded.");
      setText("");
    } catch {
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link to="/student/home">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </Button>

      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {cls ? `${cls.course} · ${cls.section}` : "Session"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{session.topic}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Open {formatDT(session.startsAt)} → {formatDT(session.endsAt)}
        </p>
      </div>

      <Card className="flex flex-1 flex-col border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">Your anonymous feedback</CardTitle>
          <CardDescription>
            Taglish is welcome — write naturally. Your submission is anonymous.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-5">
          {isActive && !sessionEnded ? (
            <>
              <Badge variant="outline" className="w-fit border-primary/30 text-primary">
                active · {session.topic}
              </Badge>
              <div className="space-y-2">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Sir mabilis po yung discussion sa typecasting, hirap mahabol…"
                  className="min-h-[160px] resize-none"
                  maxLength={600}
                />
                <p className="text-right text-[11px] text-muted-foreground">{text.length} / 600</p>
              </div>
              <div className="mt-auto space-y-3">
                <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
                  <Send className="h-4 w-4" />
                  {submitting ? "Submitting…" : "Submit feedback"}
                </Button>
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Read the Privacy Policy
                </a>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center py-12 text-center text-sm text-muted-foreground">
              This session has ended.
            </div>
          )}
        </CardContent>
      </Card>

      <InfoDialog
        isOpen={sessionEnded}
        title="Session ended"
        description={
          isActive
            ? `The "${session.topic}" session ended while you were typing. Feedback is no longer being accepted.`
            : `The "${session.topic}" session has already ended. Feedback is no longer being accepted.`
        }
        actionLabel="Go back home"
        onAction={goHome}
      />
    </div>
  );
}
