// Guided-tour server-side lifecycle: sandbox cleanup and the per-account
// auto-start flag.
//
// Server-side tutorial lifecycle: sandbox cleanup via RPC and account auto-start flag.

import { supabase } from "@/lib/db/supabase";

export async function deleteTutorialSandbox(_facultyId?: string): Promise<void> {
  const { error } = await supabase.rpc("delete_tutorial_sandbox");
  if (error) throw new Error(error.message);
}

/** `profiles.tutorial_shown_at` for the faculty; null means the tour never auto-opened. */
export async function fetchTutorialShownAt(facultyId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("tutorial_shown_at")
    .eq("id", facultyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.tutorial_shown_at as string | null) ?? null;
}

/** Persists tutorial completion timestamp with an insert fallback for pre-trigger profile rows. */
export async function ensureTutorialShown(facultyId: string): Promise<void> {
  const shownAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .update({ tutorial_shown_at: shownAt })
    .eq("id", facultyId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: facultyId, tutorial_shown_at: shownAt });
  if (insertError) throw new Error(insertError.message);
}
