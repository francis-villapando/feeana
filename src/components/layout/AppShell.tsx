import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/stores/auth";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  to: string;
}

export function AppShell({ navItems, children }: { navItems: NavItem[]; children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                <Activity className="h-4 w-4 text-primary" />
              </span>
              <span className="text-base font-semibold tracking-tight">Feeana</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeProps={{
                    className:
                      "rounded-md px-3 py-1.5 text-sm font-medium text-primary bg-primary/10",
                  }}
                  inactiveProps={{
                    className:
                      "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/privacy-policy"
              className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:flex"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Privacy
            </Link>
            {user && (
              <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">{user.role}</span>
                <span className="font-medium">{user.name}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate({ to: user?.role === "faculty" ? "/login/faculty" : "/login/student" });
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
