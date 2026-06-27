import { useEffect, useState } from "react";
import { computeSessionDisplayStatus, type SessionDisplayStatus } from "@/lib/utils/sessionStatusUtils";
import type { Session } from "@/lib/types/types";

export function useSessionDisplayStatus(session: Session): SessionDisplayStatus {
  const [displayStatus, setDisplayStatus] = useState(() => computeSessionDisplayStatus(session));

  useEffect(() => {
    const currentStatus = computeSessionDisplayStatus(session);
    setDisplayStatus(currentStatus);

    if (session.status === "archived") return;

    const now = Date.now();
    const startsAt = new Date(session.startsAt).getTime();
    const grace = new Date(session.endsAt);
    grace.setSeconds(59, 999);
    const closedAt = grace.getTime() + 1;

    const nextUpdate = Math.min(
      now < startsAt ? startsAt - now : Infinity,
      now < closedAt ? closedAt - now : Infinity,
    );
    if (nextUpdate === Infinity || !isFinite(nextUpdate) || nextUpdate <= 0) return;

    const timer = setTimeout(
      () => setDisplayStatus(computeSessionDisplayStatus(session)),
      Math.min(nextUpdate, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [session, session.startsAt, session.endsAt, session.status, displayStatus]);

  return displayStatus;
}
