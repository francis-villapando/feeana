import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Feedback } from "../types/types";
import * as feedbackService from "../services/feedbackService";
import { friendlyError } from "../hooks/utils";

interface FeedbackStoreValue {
  feedback: Feedback[];
  isLoading: boolean;
  error: string | null;
  addFeedback: (sessionId: string, rawText: string) => Promise<Feedback>;
  addBulkFeedback: (sessionId: string, texts: string[]) => Promise<Feedback[]>;
  fetchFeedback: (sessionId: string) => Promise<Feedback[]>;
  fetchFeedbackByClass: (classId: string) => Promise<Feedback[]>;
  fetchFeedbackBySessions: (sessionIds: string[]) => Promise<Feedback[]>;
  feedbackForSession: (sessionId: string) => Feedback[];
  insertRealtimeFeedback: (fb: Feedback) => void;
}

const FeedbackStoreContext = createContext<FeedbackStoreValue | null>(null);

function mergeFeedback(prev: Feedback[], incoming: Feedback[]): Feedback[] {
  if (incoming.length === 0) return prev;
  const incomingSessionIds = new Set(incoming.map((f) => f.sessionId));
  const others = prev.filter((f) => !incomingSessionIds.has(f.sessionId));
  return [...others, ...incoming];
}

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
      setError(friendlyError(e, "Failed to load feedback"));
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFeedbackByClass = useCallback(async (classId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await feedbackService.getFeedbackByClass(classId);
      setFeedback((prev) => mergeFeedback(prev, data));
      return data;
    } catch (e) {
      setError(friendlyError(e, "Failed to load feedback"));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFeedbackBySessions = useCallback(async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return [];
    setIsLoading(true);
    setError(null);
    try {
      const data = await feedbackService.getFeedbackBySessions(sessionIds);
      setFeedback((prev) => mergeFeedback(prev, data));
      return data;
    } catch (e) {
      setError(friendlyError(e, "Failed to load feedback"));
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

  const addBulkFeedback = useCallback(async (sessionId: string, texts: string[]) => {
    const inserted = await feedbackService.bulkInsertFeedback(sessionId, texts);
    setFeedback((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      return [...prev, ...inserted.filter((f) => !existingIds.has(f.id))];
    });
    return inserted;
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
    () => ({
      feedback,
      isLoading,
      error,
      addFeedback,
      addBulkFeedback,
      fetchFeedback,
      fetchFeedbackByClass,
      fetchFeedbackBySessions,
      feedbackForSession,
      insertRealtimeFeedback,
    }),
    [
      feedback,
      isLoading,
      error,
      addFeedback,
      addBulkFeedback,
      fetchFeedback,
      fetchFeedbackByClass,
      fetchFeedbackBySessions,
      feedbackForSession,
      insertRealtimeFeedback,
    ],
  );

  return <FeedbackStoreContext.Provider value={value}>{children}</FeedbackStoreContext.Provider>;
}

export function useFeedbackStore() {
  const ctx = useContext(FeedbackStoreContext);
  if (!ctx) throw new Error("useFeedbackStore must be used within FeedbackStoreProvider");
  return ctx;
}
