import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl) {
  throw new Error(
    "Missing VITE_SUPABASE_URL environment variable. " +
    "Ensure it is defined in your .env file.",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY environment variable.\n" +
    "This is required for test setup/teardown (bypassing RLS).\n" +
    "Ensure it is defined in your .env file.\n" +
    "If running from PowerShell, try: $env:SUPABASE_SERVICE_ROLE_KEY='your-key-here'",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
