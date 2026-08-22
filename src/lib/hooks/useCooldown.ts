import { useCallback, useEffect, useState } from "react";

function readExpiry(storageKey?: string): number {
  if (!storageKey || typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return 0;
  const expiry = Number(raw);
  return Number.isFinite(expiry) && expiry > Date.now() ? expiry : 0;
}

export function useCooldown(storageKey?: string, defaultSeconds = 60) {
  const [expiresAt, setExpiresAt] = useState(() => readExpiry(storageKey));
  const [secondsLeft, setSecondsLeft] = useState(() =>
    expiresAt > 0 ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0,
  );
  const isActive = secondsLeft > 0;

  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setExpiresAt(0);
        if (storageKey && typeof window !== "undefined") {
          sessionStorage.removeItem(storageKey);
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, isActive, storageKey]);

  const startCooldown = useCallback(
    (seconds = defaultSeconds) => {
      const expiry = Date.now() + seconds * 1000;
      setExpiresAt(expiry);
      setSecondsLeft(seconds);
      if (storageKey && typeof window !== "undefined") {
        sessionStorage.setItem(storageKey, String(expiry));
      }
    },
    [defaultSeconds, storageKey],
  );

  const resetCooldown = useCallback(() => {
    setExpiresAt(0);
    setSecondsLeft(0);
    if (storageKey && typeof window !== "undefined") {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return { secondsLeft, isActive, startCooldown, resetCooldown };
}
