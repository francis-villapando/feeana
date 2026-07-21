import type { ReactNode } from "react";

export function AccentLabel({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-primary">{children}</strong>;
}
