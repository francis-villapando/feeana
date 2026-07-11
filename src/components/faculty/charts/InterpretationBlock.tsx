import React from "react";

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function InterpretationBlock({ text }: { text: string }) {
  return (
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/30 pl-3 italic">
      {parseBold(text)}
    </p>
  );
}
