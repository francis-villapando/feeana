import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Feedback } from "./types";
import * as feedbackService from "./services/feedbackService";

interface FeedbackStoreValue {
  feedback: Feedback[];
  isLoading: boolean;
  error: string | null;
  addFeedback: (sessionId: string, rawText: string) => Promise<Feedback>;
  fetchFeedback: (sessionId: string) => Promise<Feedback[]>;
  fetchFeedbackByClass: (classId: string) => Promise<Feedback[]>;
  feedbackForSession: (sessionId: string) => Feedback[];
  insertRealtimeFeedback: (fb: Feedback) => void;
}

const FeedbackStoreContext = createContext<FeedbackStoreValue | null>(null);

export function FeedbackStoreProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await feedbackService.getFeedback(sessionId);
      setFeedback((prev) => {
        const others = prev.filter((f) => f.sessionId !== sessionId);
        return [...others, ...data];
      });
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feedback");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFeedbackByClass = useCallback(async (classId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await feedbackService.getFeedbackByClass(classId);
      setFeedback(data);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feedback");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addFeedback = useCallback(async (sessionId: string, rawText: string) => {
    const entry = await feedbackService.submitFeedback(sessionId, rawText);
    setFeedback((prev) => [...prev, entry]);
    return entry;
  }, []);

  const insertRealtimeFeedback = useCallback((fb: Feedback) => {
    setFeedback((prev) => {
      if (prev.some((f) => f.id === fb.id)) return prev;
      return [...prev, fb];
    });
  }, []);

  const feedbackForSession = useCallback(
    (sessionId: string) => feedback.filter((f) => f.sessionId === sessionId),
    [feedback],
  );

  const value = useMemo<FeedbackStoreValue>(
    () => ({ feedback, isLoading, error, addFeedback, fetchFeedback, fetchFeedbackByClass, feedbackForSession, insertRealtimeFeedback }),
    [feedback, isLoading, error, addFeedback, fetchFeedback, fetchFeedbackByClass, feedbackForSession, insertRealtimeFeedback],
  );

  return <FeedbackStoreContext.Provider value={value}>{children}</FeedbackStoreContext.Provider>;
}

export function useFeedbackStore() {
  const ctx = useContext(FeedbackStoreContext);
  if (!ctx) throw new Error("useFeedbackStore must be used within FeedbackStoreProvider");
  return ctx;
}
