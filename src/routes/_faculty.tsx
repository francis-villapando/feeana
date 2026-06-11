import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader, FacultySidebar } from "@/components/layout";
import { useAuth } from "@/lib/auth";

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
          <AppHeader role="faculty" userName={user.name} onSignOut={async () => { await logout(); navigate({ to: "/" }); }} />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
