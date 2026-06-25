import { serve } from "std/server";
import { hashToken } from "./helpers";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serverSalt = Deno.env.get("SERVER_SALT")!;

    const auth = req.headers.get("authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    const body = await req.json();
    const { token, content, meta } = body;
    if (!token || !content)
      return new Response(JSON.stringify({ error: "token and content required" }), { status: 400 });

    // derive sessionId from url
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const sessionId =
      parts[parts.length - 2] === "session" ? parts[parts.length - 1] : parts[parts.length - 1];

    const tokenHash = await hashToken(token, serverSalt);

    // verify session is still active
    const sessionRes = await fetch(
      `${supabaseUrl}/rest/v1/sessions?id=eq.${sessionId}&select=starts_at,ends_at,status`,
      {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      },
    );
    const sessionRows = await sessionRes.json();
    if (!sessionRes.ok || sessionRows.length === 0)
      return new Response(JSON.stringify({ error: "session_not_found" }), { status: 404 });
    const session = sessionRows[0];
    if (session.status !== "active")
      return new Response(JSON.stringify({ error: "session_ended" }), { status: 403 });
    if (new Date(session.starts_at) > new Date())
      return new Response(JSON.stringify({ error: "session_ended" }), { status: 403 });
    if (new Date(session.ends_at) < new Date())
      return new Response(JSON.stringify({ error: "session_ended" }), { status: 403 });

    // find token row
    const findRes = await fetch(
      `${supabaseUrl}/rest/v1/submission_tokens?session_id=eq.${sessionId}&token_hash=eq.${tokenHash}&used=eq.false`,
      {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      },
    );
    const rows = await findRes.json();
    if (!findRes.ok || rows.length === 0)
      return new Response(JSON.stringify({ error: "invalid_or_used_token" }), { status: 403 });
    const tokenRow = rows[0];

    // transaction: mark token used, insert feedback
    // Supabase REST does not support multi-statement transactions here; we rely on eventual consistency for MVP
    // mark token used
    await fetch(`${supabaseUrl}/rest/v1/submission_tokens?id=eq.${tokenRow.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ used: true, used_at: new Date().toISOString() }),
    });

    // insert feedback
    await fetch(`${supabaseUrl}/rest/v1/feedback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId, content, meta: meta || {} }),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
