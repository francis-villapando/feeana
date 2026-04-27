import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Feeana" },
      {
        name: "description",
        content:
          "How Feeana collects, processes, and protects student feedback data, in line with the consent module of the underlying study.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </Button>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Consent Module — Feeana Research Build</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">What we collect</h2>
          <p className="mt-2">
            Feeana collects short, free-text feedback you submit during a class session. Submissions
            are tied to the session you select, not to your personal identity. Faculty see
            aggregated analyses, not your name.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">How it is used</h2>
          <p className="mt-2">
            Your text is preprocessed (noise removal, vowel normalization, abbreviation expansion),
            classified as pedagogical or non-pedagogical, and analyzed for aspects and sentiment.
            Results are mapped to Intended Learning Outcomes and educational theories (Revised
            Bloom, Cognitive Load Theory, Teaching Through Interactions).
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Your consent</h2>
          <p className="mt-2">
            By submitting feedback you confirm voluntary participation. You can withhold any session
            — there is no penalty for not submitting. No personally identifying content should be
            included in your text.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">Storage</h2>
          <p className="mt-2">
            This MVP stores all data in browser memory only. No external server persists your input.
          </p>
        </section>
      </div>
    </div>
  );
}
