import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader, FacultySidebar } from "@/components/layout";
import { useAuth } from "@/lib/stores/auth";

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
        <header className="sticky top-0 z-[60] border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <AppHeader role="faculty" userName={user.name} onSignOut={async () => { await logout(); navigate({ to: "/login/faculty" }); }} sidebarTrigger />
        </header>
        <main className="w-full flex-1 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
