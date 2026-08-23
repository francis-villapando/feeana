import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AnalysisResult } from "../types/types";
import { supabase } from "../db/supabase";

interface AnalysisStoreValue {
  results: Record<string, AnalysisResult>;
  isLoading: boolean;
  set: (sessionId: string, result: AnalysisResult) => void;
  get: (sessionId: string) => AnalysisResult | undefined;
  fetchForSessions: (sessionIds: string[]) => Promise<void>;
}

const AnalysisStoreContext = createContext<AnalysisStoreValue | null>(null);

export function AnalysisStoreProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [isLoading, setIsLoading] = useState(false);

  const set = useCallback((sessionId: string, result: AnalysisResult) => {
    setResults((prev) => ({ ...prev, [sessionId]: result }));
  }, []);

  const get = useCallback((sessionId: string) => results[sessionId], [results]);

  const fetchForSessions = useCallback(async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback_diagnostics")
        .select("session_id, result")
        .in("session_id", sessionIds);

      if (error) {
        console.error("Error fetching analysis results:", error);
        return;
      }

      const newResults: Record<string, AnalysisResult> = {};
      for (const row of data || []) {
        if (row.result) {
          newResults[row.session_id] = row.result as AnalysisResult;
        }
      }

      setResults((prev) => ({ ...prev, ...newResults }));
    } catch (err) {
      console.error("Failed to batch fetch analysis results:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AnalysisStoreValue>(
    () => ({ results, isLoading, set, get, fetchForSessions }),
    [results, isLoading, set, get, fetchForSessions],
  );

  return <AnalysisStoreContext.Provider value={value}>{children}</AnalysisStoreContext.Provider>;
}

export function useAnalysisStore() {
  const ctx = useContext(AnalysisStoreContext);
  if (!ctx) throw new Error("useAnalysisStore must be used within AnalysisStoreProvider");
  return ctx;
}
