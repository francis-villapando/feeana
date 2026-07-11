import { Skeleton } from "@/components/ui/skeleton";

export function ListItemSkeleton({ width }: { width?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={`h-4 ${width ?? "w-48"}`} />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-4 w-4 shrink-0" />
    </div>
  );
}
