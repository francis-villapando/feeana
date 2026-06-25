import { useEffect, useState } from "react";
import { computeSessionDisplayStatus, type SessionDisplayStatus } from "@/lib/utils/sessionStatusUtils";
import type { Session } from "@/lib/types/types";

export function useSessionDisplayStatus(session: Session): SessionDisplayStatus {
  const [displayStatus, setDisplayStatus] = useState(() => computeSessionDisplayStatus(session));

  useEffect(() => {
    setDisplayStatus(computeSessionDisplayStatus(session));

    if (session.status === "archived") return;

    const now = Date.now();
    const startsAt = new Date(session.startsAt).getTime();
    const endsAt = new Date(session.endsAt).getTime();

    const nextUpdate = Math.min(
      now < startsAt ? startsAt - now : Infinity,
      now < endsAt ? endsAt - now : Infinity,
    );
    if (nextUpdate === Infinity || !isFinite(nextUpdate)) return;

    const timer = setTimeout(
      () => setDisplayStatus(computeSessionDisplayStatus(session)),
      Math.min(nextUpdate, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [session, session.startsAt, session.endsAt, session.status]);

  return displayStatus;
}
