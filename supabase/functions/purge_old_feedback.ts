import { serve } from "std/server";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // delete feedback older than 90 days
    const sql = `DELETE FROM feedback WHERE created_at < now() - interval '90 days'`;
    // Use REST to run via rpc? For MVP we will call SQL via Postgres function if available; for now use Supabase SQL endpoint if configured.
    // This is a placeholder: in production use pg client to run SQL.

    return new Response(JSON.stringify({ ok: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
