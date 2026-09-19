import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/hooks/utils";

interface DistributionEmptyStateProps {
  title: string;
  description: ReactNode;
  className?: string;
}

export function DistributionEmptyState({
  title,
  description,
  className,
}: DistributionEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center gap-2 px-6 text-center",
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
