import { Skeleton } from "@/components/ui/skeleton";

export function LayoutSkeleton() {
  return (
    <div className="flex h-screen w-full">
      <div className="hidden md:flex w-64 flex-col gap-4 border-r border-border/60 bg-card/30 p-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-2 pt-4">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="space-y-2 pt-4">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-[60] flex h-14 items-center border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
          <Skeleton className="h-6 w-6 rounded-md md:hidden" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
        <main className="flex-1 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className="space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card/70 p-5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                  <Skeleton className="mt-3 h-9 w-16" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
