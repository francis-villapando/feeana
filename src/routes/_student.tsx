import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Activity, BookOpenCheck, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EnrollClassDialog } from "@/components/student";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/common";

export const Route = createFileRoute("/_student")({
  component: StudentLayout,
});

function StudentLayout() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [enrollOpen, setEnrollOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "student") {
      navigate({ to: "/login/student" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return null;
  }

  if (!user || user.role !== "student") {
    return null;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/student/home" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Activity className="h-4 w-4 text-primary" />
            </span>
            <span className="text-base font-semibold tracking-tight">Feeana</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:flex"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Privacy
            </a>
            {user && (
              <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-muted-foreground capitalize">{user.role}</span>
                <span className="font-medium">{user.name}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <EnrollClassDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  );
}