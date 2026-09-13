import { GraduationCap, ShieldCheck } from "lucide-react";

const THESIS_TITLE =
  "AI-Powered Feedback Analyzer for Enhancing Teaching Strategies in Digital Classrooms";

const INSTITUTION = "Pamantasan ng Cabuyao (University of Cabuyao) — College of Computing Studies";

const RESEARCHERS = ["Lexin Andrei Artillero", "Roseanne Borbe", "Francis Villapando"];

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 py-8 text-center">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <GraduationCap className="h-4 w-4 text-primary" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Feeana <span className="font-normal text-muted-foreground">· BSCS Thesis Research</span>
          </span>
        </div>
        <p className="max-w-2xl text-sm font-medium text-foreground/90">
          &ldquo;{THESIS_TITLE}&rdquo;
        </p>
        <p className="text-xs text-muted-foreground">{INSTITUTION}</p>
        <p className="text-xs text-muted-foreground">Researchers: {RESEARCHERS.join(" • ")}</p>
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Privacy Policy
        </a>
      </div>
    </footer>
  );
}
