import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/common";

type AuthLandingCardProps = {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

export function AuthLandingCard({
  icon: Icon,
  iconClassName,
  title,
  description,
  children,
}: AuthLandingCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${
                    iconClassName ?? "bg-primary/15 text-primary ring-primary/30"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="text-xl">{title}</CardTitle>
                  {description && <CardDescription>{description}</CardDescription>}
                </div>
              </div>
              <ThemeToggle />
            </div>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
