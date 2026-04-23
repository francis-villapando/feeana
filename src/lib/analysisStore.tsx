import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AnalysisResult } from "./types";

const STORAGE_KEY = "feeana.analyses";

interface AnalysisStoreValue {
  results: Record<string, AnalysisResult>;
  set: (sessionId: string, result: AnalysisResult) => void;
  get: (sessionId: string) => AnalysisResult | undefined;
}

const AnalysisStoreContext = createContext<AnalysisStoreValue | null>(null);

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AnalysisStoreProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});

  useEffect(() => {
    setResults(readJSON<Record<string, AnalysisResult>>(STORAGE_KEY, {}));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    }
  }, [results]);

  const set = useCallback((sessionId: string, result: AnalysisResult) => {
    setResults((prev) => ({ ...prev, [sessionId]: result }));
  }, []);

  const get = useCallback(
    (sessionId: string) => results[sessionId],
    [results],
  );

  const value = useMemo<AnalysisStoreValue>(
    () => ({ results, set, get }),
    [results, set, get],
  );

  return (
    <AnalysisStoreContext.Provider value={value}>
      {children}
    </AnalysisStoreContext.Provider>
  );
}

export function useAnalysisStore() {
  const ctx = useContext(AnalysisStoreContext);
  if (!ctx)
    throw new Error("useAnalysisStore must be used within AnalysisStoreProvider");
  return ctx;
}
