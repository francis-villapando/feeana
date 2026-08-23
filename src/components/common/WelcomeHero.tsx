import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HeroAction {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  onClick?: () => void;
  href?: string;
}

interface SectionHeroProps {
  badge: string;
  badgeIcon?: ReactNode;
  title: string;
  description: string;
  actions: HeroAction[];
  inline?: boolean;
}

export function WelcomeHero({
  badge,
  badgeIcon,
  title,
  description,
  actions,
  inline = false,
}: SectionHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/70 to-card/40 p-8 backdrop-blur-xl">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div
        className={
          inline
            ? "relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
            : "relative flex flex-col gap-6"
        }
      >
        <div className={inline ? undefined : "max-w-2xl"}>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {badgeIcon ?? <Sparkles className="h-3 w-3" />} {badge}
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-col gap-2 sm:max-w-60">
            {actions.map((action) =>
              action.href ? (
                <Button key={action.label} asChild size="lg" variant={action.variant ?? "default"}>
                  <Link to={action.href}>
                    {action.icon}
                    {action.label}
                  </Link>
                </Button>
              ) : (
                <Button
                  key={action.label}
                  size="lg"
                  variant={action.variant ?? "default"}
                  onClick={action.onClick}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}
