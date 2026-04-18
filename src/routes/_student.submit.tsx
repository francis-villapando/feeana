import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFeedbackStore } from "@/lib/feedbackStore";
import { MOCK_COURSE, MOCK_ILOS, MOCK_SESSIONS } from "@/lib/mockData";

export const Route = createFileRoute("/_student/submit")({
  head: () => ({
    meta: [
      { title: "Submit feedback — Feeana" },
      {
        name: "description",
        content: "Share your honest, anonymous feedback for the selected session.",
      },
    ],
  }),
  component: SubmitPage,
});

function SubmitPage() {
  const { addFeedback } = useFeedbackStore();
  const [sessionId, setSessionId] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const session = MOCK_SESSIONS.find((s) => s.id === sessionId);
  const linkedIlos = session
    ? MOCK_ILOS.filter((i) => session.iloIds.includes(i.id))
    : [];

  const handleSubmit = () => {
    if (!sessionId) {
      toast.error("Please pick a session.");
      return;
    }
    if (text.trim().length < 4) {
      toast.error("Feedback must be at least a few characters.");
      return;
    }
    setSubmitting(true);
    addFeedback(sessionId, text);
    setTimeout(() => {
      toast.success("Salamat! Your feedback was recorded.");
      setText("");
      setSubmitting(false);
    }, 500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {MOCK_COURSE.code} · Student portal
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Submit feedback
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Taglish is welcome — write naturally. Your submission is anonymous and
          tied only to the session.
        </p>
      </div>

      <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">Choose a session</CardTitle>
          <CardDescription>
            Pick the lecture you want to give feedback on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {MOCK_SESSIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.topic}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {session && (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Linked ILOs
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {linkedIlos.map((ilo) => (
                  <Badge
                    key={ilo.id}
                    variant="outline"
                    className="border-primary/30 text-primary"
                  >
                    {ilo.code} · {ilo.bloomLevel}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fb">
              Your feedback
            </label>
            <Textarea
              id="fb"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Sir mabilis po yung discussion sa typecasting, hirap mahabol…"
              className="min-h-[140px] resize-none"
              maxLength={600}
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {text.length} / 600
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
            size="lg"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting…" : "Submit feedback"}
          </Button>

          <Link
            to="/privacy"
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Read the Privacy Policy
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
