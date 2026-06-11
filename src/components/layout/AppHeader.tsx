import { Link } from "@tanstack/react-router";
import { Activity, LogOut, Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/common";

interface AppHeaderProps {
  role: "faculty" | "student";
  userName: string;
  onSignOut: () => void;
  contained?: boolean;
}

export function AppHeader({ role, userName, onSignOut, contained = false }: AppHeaderProps) {
  const homeRoute = role === "faculty" ? "/home" : "/student/home";

  const controls = (
    <>
      <ThemeToggle />
      <a
        href="/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:flex"
      >
        <ShieldCheck className="h-3.5 w-3.5" /> Privacy
      </a>
      <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-muted-foreground capitalize">{role}</span>
        <span className="font-medium">{userName}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onSignOut}>
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </>
  );

  return (
    <div
      className={`flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8${contained ? " mx-auto max-w-7xl" : ""}`}
    >
      <Link to={homeRoute} className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <Activity className="h-4 w-4 text-primary" />
        </span>
        <span className="text-base font-semibold tracking-tight">Feeana</span>
      </Link>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-3">{controls}</div>
        <Sheet>
          <SheetTrigger asChild className="sm:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col items-start gap-4">
              {controls}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
