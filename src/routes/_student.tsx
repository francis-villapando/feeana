import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout";
import { EnrollClassDialog } from "@/components/student";
import { useAuth } from "@/lib/stores/auth";
import { LayoutSkeleton } from "@/components/skeletons";

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
      navigate({ to: "/auth/student" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return <LayoutSkeleton />;
  }

  if (!user || user.role !== "student") {
    return null;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[60] border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <AppHeader
          role="student"
          userName={user.name}
          onSignOut={async () => {
            await logout();
            navigate({ to: "/auth/student" });
          }}
          contained
        />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <EnrollClassDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  );
}
