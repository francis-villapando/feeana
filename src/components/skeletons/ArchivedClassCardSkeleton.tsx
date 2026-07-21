import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ArchivedClassCardSkeleton() {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
