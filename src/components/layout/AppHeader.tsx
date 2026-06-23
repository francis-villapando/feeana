import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppMenu } from "@/components/layout/AppMenu";

interface AppHeaderProps {
  role: "faculty" | "student";
  userName: string;
  onSignOut: () => void;
  contained?: boolean;
  sidebarTrigger?: boolean;
}

export function AppHeader({ role, userName, onSignOut, contained = false, sidebarTrigger = false }: AppHeaderProps) {
  const homeRoute = role === "faculty" ? "/home" : "/student/home";

  return (
    <div
      className={`flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8${contained ? " mx-auto max-w-7xl" : ""}`}
    >
      <div className="flex items-center gap-1">
        {sidebarTrigger && (
          <SidebarTrigger className="h-8 w-8 rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/25 md:hidden" />
        )}
        <Link to={homeRoute} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Activity className="h-4 w-4 text-primary" />
          </span>
          <span className="text-base font-semibold tracking-tight">Feeana</span>
        </Link>
      </div>
      <AppMenu role={role} userName={userName} onSignOut={onSignOut} />
    </div>
  );
}
