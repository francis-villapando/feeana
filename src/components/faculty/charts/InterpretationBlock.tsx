import type { ReactNode } from "react";

export function InterpretationBlock({ text }: { text: ReactNode }) {
  return (
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/30 pl-3 italic">
      {text}
    </p>
  );
}
