import type { Session } from "@/lib/types/types";

export type SessionDisplayStatus = "upcoming" | "active" | "closed" | "archived";

export function computeSessionDisplayStatus(session: Session, now?: Date): SessionDisplayStatus {
  if (session.status === "archived") return "archived";
  const current = now ?? new Date();
  if (current < new Date(session.startsAt)) return "upcoming";
  const grace = new Date(session.endsAt);
  grace.setSeconds(59, 999);
  if (current > grace) return "closed";
  return "active";
}

export function isSessionActive(session: Session, now?: Date): boolean {
  return computeSessionDisplayStatus(session, now) === "active";
}
