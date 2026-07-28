import { AlertCircle } from "lucide-react";

interface InlineErrorProps {
  errorMessage?: string;
}

export const destructiveBorder = "border-destructive focus-visible:ring-destructive";

export function InlineError({ errorMessage }: InlineErrorProps) {
  if (!errorMessage) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive mt-2 animate-in fade-in-50 duration-150">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="font-medium leading-normal">{errorMessage}</span>
    </div>
  );
}
