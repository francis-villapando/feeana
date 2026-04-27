import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { MOCK_ILOS } from "@/lib/mockData";
import type { Recommendation, RecommendationTerm, TermKind } from "@/lib/types";

const KIND_LABEL: Record<TermKind, string> = {
  issue: "Issue",
  aspect: "Aspect",
  RBT: "Revised Bloom's Taxonomy",
  CLT: "Cognitive Load Theory",
  TTI: "Teaching Through Interactions",
  ILO: "Intended Learning Outcome",
};

interface Segment {
  text: string;
  term?: RecommendationTerm;
}

/** Tokenize the paragraph by walking each term in declaration order. */
function tokenize(paragraph: string, terms: RecommendationTerm[]): Segment[] {
  let segments: Segment[] = [{ text: paragraph }];
  for (const term of terms) {
    if (!term.text) continue;
    const next: Segment[] = [];
    for (const seg of segments) {
      if (seg.term) {
        next.push(seg);
        continue;
      }
      const idx = seg.text.toLowerCase().indexOf(term.text.toLowerCase());
      if (idx === -1) {
        next.push(seg);
        continue;
      }
      const before = seg.text.slice(0, idx);
      const match = seg.text.slice(idx, idx + term.text.length);
      const after = seg.text.slice(idx + term.text.length);
      if (before) next.push({ text: before });
      next.push({ text: match, term });
      if (after) next.push({ text: after });
    }
    segments = next;
  }
  return segments;
}

function resolveDetail(term: RecommendationTerm): {
  heading: string;
  body: string;
} {
  if (term.kind === "ILO" && term.iloId) {
    const ilo = MOCK_ILOS.find((i) => i.id === term.iloId);
    return {
      heading: KIND_LABEL.ILO,
      body: ilo?.statement ?? term.detail,
    };
  }
  return { heading: KIND_LABEL[term.kind], body: term.detail };
}

export function RecommendationParagraph({ rec, index }: { rec: Recommendation; index: number }) {
  const segments = tokenize(rec.paragraph, rec.terms);
  return (
    <li className="rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs font-semibold text-primary">
          {String(index + 1).padStart(2, "0")}
        </span>
        <p className="flex-1 text-sm leading-relaxed">
          {segments.map((seg, i) => {
            if (!seg.term) return <span key={i}>{seg.text}</span>;
            const { heading, body } = resolveDetail(seg.term);
            return (
              <HoverCard key={i} openDelay={120} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <span className="cursor-help text-primary underline decoration-primary/40 decoration-dotted underline-offset-4 hover:decoration-primary">
                    {seg.text}
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80" align="start">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {heading}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{body}</p>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </p>
      </div>
    </li>
  );
}
