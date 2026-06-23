import { LogOut, Lock, Menu, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/common";
import { useTheme } from "@/lib/providers/themeProvider";
import { SignOutDialog, ResetPasswordDialog } from "@/components/auth";
import { useState } from "react";

interface AppMenuProps {
  role: "faculty" | "student";
  userName: string;
  onSignOut: () => void;
}

export function AppMenu({ role, userName, onSignOut }: AppMenuProps) {
  const { theme, setTheme } = useTheme();
  const [resetOpen, setResetOpen] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);

  return (
    <>
      {/* Desktop: inline horizontal layout */}
      <div className="hidden md:flex items-center gap-3">
        <ThemeToggle size="icon" />
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Privacy
        </a>
        <Popover open={badgeOpen} onOpenChange={setBadgeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 text-xs hover:bg-card/70"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-muted-foreground capitalize">{role}</span>
              <span className="font-medium">{userName}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto min-w-40 p-1">
            <button
              type="button"
              onClick={() => { setBadgeOpen(false); setResetOpen(true); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <Lock className="h-4 w-4 text-muted-foreground" />
              Reset password
            </button>
          </PopoverContent>
        </Popover>
        <SignOutDialog onConfirm={onSignOut}>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </SignOutDialog>
      </div>

      {/* Mobile: popover menu */}
      <Popover>
        <PopoverTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto min-w-48 p-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground capitalize">{role}</span>
            <span className="text-sm font-medium">{userName}</span>
          </div>

          <Separator className="my-1.5" />

          <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Account
          </div>
          <div className="px-1 pb-1">
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <Lock className="h-4 w-4 text-muted-foreground" />
              Reset password
            </button>
          </div>

          <Separator className="my-1.5" />

          <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Theme
          </div>
          <div className="grid grid-cols-3 gap-1 px-1 pb-1.5">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent${theme === "light" ? " bg-accent font-semibold text-primary" : ""}`}
            >
              <Sun className="h-3.5 w-3.5" /> Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent${theme === "dark" ? " bg-accent font-semibold text-primary" : ""}`}
            >
              <Moon className="h-3.5 w-3.5" /> Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent${theme === "system" ? " bg-accent font-semibold text-primary" : ""}`}
            >
              <Monitor className="h-3.5 w-3.5" /> System
            </button>
          </div>

          <Separator className="my-1.5" />

          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
          >
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Privacy policy
          </a>

          <Separator className="my-1.5" />

          <SignOutDialog onConfirm={onSignOut}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </SignOutDialog>
        </PopoverContent>
      </Popover>

      <ResetPasswordDialog open={resetOpen} onOpenChange={setResetOpen} />
    </>
  );
}
