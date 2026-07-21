import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SessionCardSkeleton() {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-3/5 min-h-[2.75rem]" />
          <Skeleton className="h-5 w-16 rounded-full shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-sm shrink-0" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-sm shrink-0" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md shrink-0" />
          <Skeleton className="h-8 flex-1 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}
