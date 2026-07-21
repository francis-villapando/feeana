import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartCardSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
        <Skeleton className="h-3 w-48 mt-1" />
      </CardHeader>
      <CardContent>
        <Skeleton className={`w-full ${height} rounded-md`} />
      </CardContent>
    </Card>
  );
}
