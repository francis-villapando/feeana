import { Skeleton } from "@/components/ui/skeleton";

export function LayoutSkeleton() {
  return (
    <div className="flex min-h-svh w-full flex-col">
      <header className="shrink-0 sticky top-0 z-[60] border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-3 pl-2 pr-4 sm:pr-6 lg:pr-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="hidden h-7 w-7 rounded-md md:block" />
            <Skeleton className="hidden h-7 w-14 rounded-md md:block" />
            <Skeleton className="hidden h-7 w-24 rounded-full md:block" />
            <Skeleton className="h-8 w-8 rounded-full md:hidden" />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[var(--sidebar-width-icon)] shrink-0 flex-col items-center gap-2 p-2 md:flex">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}
