import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_instructor")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("feeana.auth.user");
      if (!raw) throw redirect({ to: "/login" });
      const parsed = JSON.parse(raw) as { role?: string };
      if (parsed.role !== "instructor") throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: InstructorLayout,
});

function InstructorLayout() {
  const { isAuthenticated, hasRole } = useAuth();
  if (!isAuthenticated || !hasRole("instructor")) {
    return null;
  }
  return (
    <AppShell
      navItems={[
        { label: "Dashboard", to: "/dashboard" },
        { label: "History", to: "/history" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
