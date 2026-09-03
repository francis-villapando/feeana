import { supabase } from "@/lib/db/supabase";
import type { Feedback } from "@/lib/types/types";

export function fromDbFeedback(row: Record<string, unknown>): Feedback {
  const meta = (row.meta as Record<string, unknown>) ?? {};
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    rawText: row.content as string,
    cleanedText: (meta.cleanedText as string) ?? (row.content as string),
    aspects: (meta.aspects as Feedback["aspects"]) ?? [],
    createdAt: row.created_at as string,
  };
}

export async function getFeedbackByClass(classId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*, sessions!inner(class_id)")
    .eq("sessions.class_id", classId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDbFeedback);
}

export async function getFeedback(sessionId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDbFeedback);
}

export async function getFeedbackBySessions(sessionIds: string[]): Promise<Feedback[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDbFeedback);
}

export async function submitFeedback(sessionId: string, content: string): Promise<Feedback> {
  const trimmed = content.trim();
  const { data, error } = await supabase.rpc("submit_anonymous_feedback", {
    p_session_id: sessionId,
    p_content: trimmed,
    p_meta: { cleanedText: trimmed.toLowerCase() },
  });

  if (error) {
    if (error.message === "already_submitted") {
      throw new Error("duplicate_submission");
    }
    throw new Error(error.message);
  }

  // The RPC returns only the new feedback id; reconstruct the local entry.
  return {
    id: data as string,
    sessionId,
    rawText: trimmed,
    cleanedText: trimmed.toLowerCase(),
    aspects: [],
    createdAt: new Date().toISOString(),
  };
}

export async function getStudentSubmissions(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("session_participations")
    .select("session_id")
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.session_id as string);
}
