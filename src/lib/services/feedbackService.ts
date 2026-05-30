import { supabase } from "@/lib/supabase";
import type { Feedback } from "@/lib/types";

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

export async function submitFeedback(sessionId: string, content: string): Promise<Feedback> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      session_id: sessionId,
      content,
      meta: {
        cleanedText: content.trim().toLowerCase(),
        submittedBy: user?.id,
      },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromDbFeedback(data);
}
