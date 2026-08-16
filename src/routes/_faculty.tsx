import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppHeader, FacultySidebar } from "@/components/layout";
import { useAuth } from "@/lib/stores/auth";
import { LayoutSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_faculty")({
  component: FacultyLayout,
});

function FacultyLayout() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <LayoutSkeleton />;
  }

  if (!user || user.role !== "faculty") {
    navigate({ to: "/auth/faculty" });
    return null;
  }

  return (
    <SidebarProvider defaultOpen={false} style={{ '--sidebar-top': '4rem' } as React.CSSProperties}>
      <FacultyLayoutInner user={user} logout={logout} />
    </SidebarProvider>
  );
}

function FacultyLayoutInner({ user, logout }: { user: { name: string }; logout: () => Promise<void> }) {
  const navigate = useNavigate();
  const { open } = useSidebar();
  const [hoverEnabled, setHoverEnabled] = useState(true);

  const handleSidebarTriggerClick = useCallback(() => {
    setHoverEnabled(open);
  }, [open]);

  return (
    <div className="flex min-h-svh w-full flex-col">
      <header className="shrink-0 sticky top-0 z-[60] border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <AppHeader
          role="faculty"
          userName={user.name}
          onSignOut={async () => { await logout(); navigate({ to: "/auth/faculty" }); }}
          sidebarTrigger
          onSidebarTriggerClick={handleSidebarTriggerClick}
        />
      </header>
      <div className="flex min-h-0 flex-1">
        <FacultySidebar hoverEnabled={hoverEnabled} />
        <SidebarInset className="bg-transparent">
          <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </div>
  );
}
