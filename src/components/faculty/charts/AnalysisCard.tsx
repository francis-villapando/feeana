import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/hooks/utils";

export const AnalysisCard = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Card>
>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn(
      "border-border/60 bg-card/70 backdrop-blur-xl relative hover:z-50 transition-all duration-200",
      className,
    )}
    {...props}
  />
));

AnalysisCard.displayName = "AnalysisCard";
