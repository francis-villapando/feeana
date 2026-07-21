import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}
