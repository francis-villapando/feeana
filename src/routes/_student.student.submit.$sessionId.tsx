import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Calendar, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { MOCK_SESSIONS, MOCK_CLASSES } from "@/lib/mockData";

export const Route = createFileRoute("/_student/student/submit/$sessionId")({
  loader: ({ params }) => {
    const session = MOCK_SESSIONS.find((s) => s.id === params.sessionId);
    if (!session) throw notFound();
    const cls = MOCK_CLASSES.find((c) => c.id === session.classId) ?? null;
    return { session, cls };
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
  const { session, cls } = Route.useLoaderData();
  const { addFeedback } = useFeedbackStore();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isActive = session.status === "active";

  const handleSubmit = () => {
    if (text.trim().length < 4) {
      toast.error("Feedback must be at least a few characters.");
      return;
    }
    setSubmitting(true);
    addFeedback(session.id, text);
    setTimeout(() => {
      toast.success("Salamat! Your feedback was recorded.");
      setText("");
      setSubmitting(false);
    }, 500);
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
          {isActive ? (
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
                <Link
                  to="/privacy"
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Read the Privacy Policy
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center py-12 text-center text-sm text-muted-foreground">
              This collection has ended.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
