import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  LineChart,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Feeana — Outcome-aligned feedback intelligence" },
      {
        name: "description",
        content:
          "Transform Taglish student feedback into theory-grounded teaching cues aligned with your Intended Learning Outcomes.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Feeana</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            to="/privacy"
            className="hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:flex"
          >
            <ShieldCheck className="h-4 w-4" /> Privacy
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 lg:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Outcome-aligned feedback intelligence
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Bridge the gap between{" "}
              <span className="bg-gradient-to-br from-primary to-primary/50 bg-clip-text text-transparent">
                expected
              </span>{" "}
              and actual learning.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Feeana ingests Taglish, code-switched student feedback and turns it
              into theory-grounded teaching cues — mapped to your ILOs, Bloom's
              taxonomy, and Cognitive Load principles.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/login">
                  <GraduationCap className="h-4 w-4" />
                  Instructor portal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">
                  <BookOpenCheck className="h-4 w-4" />
                  Student portal
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Demo creds: <code className="text-foreground">admin@feeana.edu / admin123</code>{" "}
              · <code className="text-foreground">student@feeana.edu / student123</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FeatureTile
              icon={<Target className="h-4 w-4" />}
              title="ILO Gap Analysis"
              body="Compare expected outcomes to what students actually experience."
              span="row-span-2"
            />
            <FeatureTile
              icon={<LineChart className="h-4 w-4" />}
              title="Aspect & Polarity"
              body="ABSA distributions across every collected feedback batch."
            />
            <FeatureTile
              icon={<Sparkles className="h-4 w-4" />}
              title="Theory-grounded cues"
              body="Hover any cue to inspect the RBT / CLT / TTI rationale."
            />
            <FeatureTile
              icon={<BookOpenCheck className="h-4 w-4" />}
              title="Before vs After"
              body="Track sentiment and issue persistence across sessions."
              span="col-span-2"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureTile({
  icon,
  title,
  body,
  span,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  span?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl transition hover:border-primary/40 ${span ?? ""}`}
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition group-hover:bg-primary/20" />
      <div className="relative">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
          {icon}
        </span>
        <h3 className="mt-4 text-sm font-semibold">{title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
