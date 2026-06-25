import type { Session } from "@/lib/types/types";

export type SessionDisplayStatus = "upcoming" | "active" | "closed" | "archived";

export function computeSessionDisplayStatus(session: Session, now?: Date): SessionDisplayStatus {
  if (session.status === "archived") return "archived";
  const current = now ?? new Date();
  if (current < new Date(session.startsAt)) return "upcoming";
  if (current > new Date(session.endsAt)) return "closed";
  return "active";
}

export function isSessionActive(session: Session, now?: Date): boolean {
  return computeSessionDisplayStatus(session, now) === "active";
}
