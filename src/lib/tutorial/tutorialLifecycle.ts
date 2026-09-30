// Guided-tour sandbox lifecycle.
//
// Hard-delete cleanup:
// Tutorial data is permanently deleted via the server-side `delete_tutorial_sandbox()` RPC,
// which safely cascades across classes, sessions, feedback, courses, topics, and ILOs.

import { supabase } from "@/lib/db/supabase";

export async function deleteTutorialSandbox(_facultyId?: string): Promise<void> {
  const { error } = await supabase.rpc("delete_tutorial_sandbox");
  if (error) throw new Error(error.message);
}
