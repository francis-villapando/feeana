import { Target, Users } from "lucide-react";
import type { ReactNode } from "react";

import { KpiCard } from "./KpiCard";

interface KeyMetricsRowProps {
  submissionRate: number;
  iloRate: number;
  submissionHint?: string;
  iloHint?: string;
  wide?: boolean;
  children?: ReactNode;
}

export function KeyMetricsRow({
  submissionRate,
  iloRate,
  submissionHint,
  iloHint,
  wide = false,
  children,
}: KeyMetricsRowProps) {
  return (
    <div className={`grid gap-4 grid-cols-2 ${wide ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
      <KpiCard
        icon={<Users className="h-4 w-4" />}
        label="Submission rate"
        value={`${submissionRate}%`}
        hint={submissionHint}
      />
      <KpiCard
        icon={<Target className="h-4 w-4" />}
        label="ILO achievement"
        value={`${iloRate}%`}
        hint={iloHint}
      />
      {children}
    </div>
  );
}
