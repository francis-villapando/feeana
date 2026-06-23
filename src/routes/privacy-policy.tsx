import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/common";

export const Route = createFileRoute("/privacy-policy")({
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
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Feeana</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Feeana — AI-Powered Feedback Analyzer for Enhancing Teaching
          Strategies in Digital Classrooms</p>
        <p className="text-xs text-muted-foreground/60">Last Updated: June 22, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-semibold text-foreground">1. What We Collect</h2>
            <p className="mt-2">
              Feeana collects short, free-text feedback that you voluntarily submit during a class session.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Tied to session, not your name:</strong> Submissions are associated with the class
                session you select and your authenticated user account (required for enrollment). Faculty
                dashboards display only aggregated analyses — they do not show which student submitted
                what.
              </li>
              <li>
                <strong>Faculty Visibility:</strong> Faculty members see aggregated trend reports, issue
                distributions, and polarity analyses.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">2. How Your Data Is Processed</h2>
            <p className="mt-2">
              Your text feedback undergoes the following automated processing steps for research purposes:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Preprocessing:</strong> Text is cleaned using noise removal, vowel normalization,
                and abbreviation expansion.
              </li>
              <li>
                <strong>Analysis:</strong> Submissions are analyzed for pedagogical issue-driven aspect-based sentiment and mapped
                to Intended Learning Outcomes (ILOs) and educational theories (Revised Bloom&#39;s
                Taxonomy, Cognitive Load Theory, and Teaching Through Interactions).
              </li>
              <li>
                <strong>AI/Third-Party Disclosure:</strong> All analysis models run entirely inside the
                faculty's browser via a Web Worker. On their first visit, a pre-trained ML model (DistilXLM-R)
                is downloaded from HuggingFace Hub into their browser cache. No raw text leaves their
                browser for inference.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">3. Data Storage and Third-Party Services</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Cloud Database:</strong> Feedback submissions, account information, and analysis
                results are stored in a Supabase (PostgreSQL) cloud database. Supabase acts as a data
                processor.
              </li>
              <li>
                <strong>No local-only storage:</strong> Data is not limited to browser memory. Clearing
                your browser cache will not delete stored data.
              </li>
              <li>
                <strong>Retention:</strong> Data is retained for the duration of this thesis.
                There is currently no automated deletion mechanism. Contact the researcher below to
                request removal of your data.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">4. Your Consent &amp; Rights</h2>
            <p className="mt-2">
              By proceeding to submit feedback through this application, you confirm your voluntary
              participation in this thesis.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>No Penalty:</strong> You can withhold feedback for any session. There is no
                academic penalty for choosing not to submit.
              </li>
              <li>
                <strong>Self-Anonymization:</strong> Please do not include personally identifying
                information (such as your name or student number) in your free-text responses.
              </li>
              <li>
                <strong>Data Access &amp; Deletion:</strong> You may request access to or deletion of
                your data by contacting the researcher below.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">5. Contact Information</h2>
            <p className="mt-2">
              If you have any questions, concerns, or requests regarding this research project and how
              data is handled, please contact:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Lead Researcher: Lexin Andrei G. Artillero</li>
              <li>Email: andreiartillero24@gmail.com</li>
              <li>Department: College of Computing Studies</li>
              <li>Course: Bachelor of Science in Computer Science</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
