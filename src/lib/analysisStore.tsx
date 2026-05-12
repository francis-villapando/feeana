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

const MOCK_ANALYSES: Record<string, AnalysisResult> = {
  "session-1": {
    sessionId: "session-1",
    totalFeedback: 12,
    pedagogicalCount: 10,
    aspectDist: [
      { label: "Pacing", value: 4 },
      { label: "Content", value: 5 },
      { label: "Examples", value: 3 },
      { label: "Materials", value: 2 },
    ],
    issueDist: [
      { label: "Too fast", value: 3 },
      { label: "Need examples", value: 2 },
      { label: "Abstract", value: 1 },
    ],
    polarityDist: [
      { label: "Negative", value: 5 },
      { label: "Neutral", value: 4 },
      { label: "Positive", value: 3 },
    ],
    gaps: [
      {
        iloId: "ilo-1",
        expected: "Understand the history of game programming.",
        actual: "Students recall milestones but struggle connecting to modern practices.",
        severity: "medium",
      },
    ],
    recommendations: [
      {
        id: "rec-1",
        priority: 2,
        theories: ["CLT"],
        paragraph: "Consider providing worked examples to bridge historical concepts to modern game programming.",
        terms: [],
      },
    ],
  },
  "session-2": {
    sessionId: "session-2",
    totalFeedback: 15,
    pedagogicalCount: 12,
    aspectDist: [
      { label: "Pacing", value: 6 },
      { label: "Content", value: 5 },
      { label: "Examples", value: 4 },
      { label: "Engagement", value: 3 },
    ],
    issueDist: [
      { label: "Too fast", value: 4 },
      { label: "Need more examples", value: 3 },
      { label: "Abstract concepts", value: 2 },
    ],
    polarityDist: [
      { label: "Negative", value: 6 },
      { label: "Neutral", value: 5 },
      { label: "Positive", value: 4 },
    ],
    gaps: [
      {
        iloId: "ilo-2",
        expected: "Understand the era of computer.",
        actual: "Students recognize eras but difficulty linking to software evolution.",
        severity: "medium",
      },
    ],
    recommendations: [
      {
        id: "rec-2",
        priority: 2,
        theories: ["TTI"],
        paragraph: "Use real-world examples from different computing eras to demonstrate software evolution.",
        terms: [],
      },
    ],
  },
};

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
  const [results, setResults] = useState<Record<string, AnalysisResult>>(() => {
    if (typeof window === "undefined") return MOCK_ANALYSES;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, AnalysisResult>;
        return Object.keys(parsed).length > 0 ? parsed : MOCK_ANALYSES;
      }
      return MOCK_ANALYSES;
    } catch {
      return MOCK_ANALYSES;
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    }
  }, [results]);

  const set = useCallback((sessionId: string, result: AnalysisResult) => {
    setResults((prev) => ({ ...prev, [sessionId]: result }));
  }, []);

  const get = useCallback((sessionId: string) => results[sessionId], [results]);

  const value = useMemo<AnalysisStoreValue>(() => ({ results, set, get }), [results, set, get]);

  return <AnalysisStoreContext.Provider value={value}>{children}</AnalysisStoreContext.Provider>;
}

export function useAnalysisStore() {
  const ctx = useContext(AnalysisStoreContext);
  if (!ctx) throw new Error("useAnalysisStore must be used within AnalysisStoreProvider");
  return ctx;
}
