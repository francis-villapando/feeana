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
    submittedBy: meta.submittedBy as string | undefined,
    studentId: row.student_id as string | undefined,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      session_id: sessionId,
      content,
      student_id: user?.id,
      meta: {
        cleanedText: content.trim().toLowerCase(),
        submittedBy: user?.id,
      },
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("duplicate_submission");
    }
    throw new Error(error.message);
  }
  return fromDbFeedback(data);
}

export async function getStudentSubmissions(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("session_id")
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.session_id as string);
}
