import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Activity, LogOut, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FacultySidebar } from "@/components/FacultySidebar";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_faculty")({
  component: FacultyLayout,
});

function FacultyLayout() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "faculty") {
      navigate({ to: "/login/faculty" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return null;
  }

  if (!user || user.role !== "faculty") {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <FacultySidebar />
      <SidebarInset className="bg-transparent">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Link to="/home" className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                  <Activity className="h-4 w-4 text-primary" />
                </span>
                <span className="text-base font-semibold tracking-tight">Feeana</span>
              </Link>
            </div>
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
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
