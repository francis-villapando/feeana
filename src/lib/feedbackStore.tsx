import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MOCK_FEEDBACK } from "./mockData";
import type { Feedback } from "./types";

interface FeedbackStoreValue {
  feedback: Feedback[];
  addFeedback: (sessionId: string, rawText: string) => Feedback;
  feedbackForSession: (sessionId: string) => Feedback[];
}

const FeedbackStoreContext = createContext<FeedbackStoreValue | null>(null);

export function FeedbackStoreProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback[]>(MOCK_FEEDBACK);

  const addFeedback = useCallback((sessionId: string, rawText: string) => {
    const entry: Feedback = {
      id: `fb-${Date.now()}`,
      sessionId,
      rawText,
      cleanedText: rawText.trim().toLowerCase(),
      isPedagogical: rawText.trim().length > 8,
      aspects: [],
      createdAt: new Date().toISOString(),
    };
    setFeedback((prev) => [...prev, entry]);
    return entry;
  }, []);

  const feedbackForSession = useCallback(
    (sessionId: string) => feedback.filter((f) => f.sessionId === sessionId),
    [feedback],
  );

  const value = useMemo<FeedbackStoreValue>(
    () => ({ feedback, addFeedback, feedbackForSession }),
    [feedback, addFeedback, feedbackForSession],
  );

  return <FeedbackStoreContext.Provider value={value}>{children}</FeedbackStoreContext.Provider>;
}

export function useFeedbackStore() {
  const ctx = useContext(FeedbackStoreContext);
  if (!ctx) throw new Error("useFeedbackStore must be used within FeedbackStoreProvider");
  return ctx;
}
