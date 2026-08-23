import { useCallback, useEffect, useMemo, useState } from "react";

const memoryStore = new Map<string, number>();

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__test_storage__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function buildCooldownKey(baseKey?: string, scope?: string): string | undefined {
  if (!baseKey) return undefined;
  const cleanScope = scope?.trim().toLowerCase();
  return cleanScope ? `${baseKey}:${cleanScope}` : baseKey;
}

export function readCooldownExpiry(key?: string): number {
  if (!key) return 0;
  const storage = getStorage();
  let raw: string | null = null;
  if (storage) {
    raw = storage.getItem(key);
  } else {
    const mem = memoryStore.get(key);
    raw = mem ? String(mem) : null;
  }
  if (!raw) return 0;
  const expiry = Number(raw);
  return Number.isFinite(expiry) && expiry > Date.now() ? expiry : 0;
}

export function saveCooldownExpiry(key: string, expiry: number) {
  const storage = getStorage();
  if (storage) {
    if (expiry > Date.now()) {
      storage.setItem(key, String(expiry));
    } else {
      storage.removeItem(key);
    }
  } else {
    if (expiry > Date.now()) {
      memoryStore.set(key, expiry);
    } else {
      memoryStore.delete(key);
    }
  }
}

export interface CooldownOptions {
  force?: boolean;
}

export function useCooldown(baseKey?: string, defaultSeconds = 60, scope?: string) {
  const key = useMemo(() => buildCooldownKey(baseKey, scope), [baseKey, scope]);

  const [expiresAt, setExpiresAt] = useState<number>(() => readCooldownExpiry(key));
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    expiresAt > 0 ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0,
  );

  // Sync state whenever the computed key changes (e.g., when the user types/changes email)
  useEffect(() => {
    const currentExpiry = readCooldownExpiry(key);
    setExpiresAt(currentExpiry);
    setSecondsLeft(currentExpiry > 0 ? Math.max(0, Math.ceil((currentExpiry - Date.now()) / 1000)) : 0);
  }, [key]);

  // Listen to cross-tab storage changes
  useEffect(() => {
    if (typeof window === "undefined" || !key) return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) {
        const currentExpiry = readCooldownExpiry(key);
        setExpiresAt(currentExpiry);
        setSecondsLeft(
          currentExpiry > 0 ? Math.max(0, Math.ceil((currentExpiry - Date.now()) / 1000)) : 0,
        );
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  const isActive = secondsLeft > 0;

  useEffect(() => {
    if (!isActive || !expiresAt) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setExpiresAt(0);
        if (key) {
          saveCooldownExpiry(key, 0);
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, isActive, key]);

  const startCooldown = useCallback(
    (seconds = defaultSeconds, options?: CooldownOptions) => {
      if (!key) return;
      const currentExpiry = readCooldownExpiry(key);
      // If already active and force is not explicitly true, preserve existing countdown
      if (!options?.force && currentExpiry > Date.now()) {
        setExpiresAt(currentExpiry);
        setSecondsLeft(Math.max(0, Math.ceil((currentExpiry - Date.now()) / 1000)));
        return;
      }

      const expiry = Date.now() + seconds * 1000;
      setExpiresAt(expiry);
      setSecondsLeft(seconds);
      saveCooldownExpiry(key, expiry);
    },
    [defaultSeconds, key],
  );

  const resetCooldown = useCallback(() => {
    setExpiresAt(0);
    setSecondsLeft(0);
    if (key) {
      saveCooldownExpiry(key, 0);
    }
  }, [key]);

  return { secondsLeft, isActive, startCooldown, resetCooldown, expiresAt };
}
