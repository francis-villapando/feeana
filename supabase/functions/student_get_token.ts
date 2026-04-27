import { serve } from "std/server";
import { hashToken, genToken } from "./helpers";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serverSalt = Deno.env.get("SERVER_SALT")!;

    const auth = req.headers.get("authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const sessionId =
      pathParts[pathParts.length - 2] === "session"
        ? pathParts[pathParts.length - 1]
        : pathParts[pathParts.length - 1];

    // get user
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: auth },
    });
    if (!userRes.ok)
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    const user = await userRes.json();

    // verify enrollment: get session and enrollments
    const sessionRes = await fetch(
      `${supabaseUrl}/rest/v1/sessions?id=eq.${sessionId}&select=class_id,ends_at`,
      {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      },
    );
    const sessions = await sessionRes.json();
    if (!sessionRes.ok || sessions.length === 0)
      return new Response(JSON.stringify({ error: "session not found" }), { status: 404 });
    const session = sessions[0];
    const enrollRes = await fetch(
      `${supabaseUrl}/rest/v1/enrollments?class_id=eq.${session.class_id}&student_id=eq.${user.id}`,
      {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      },
    );
    const enrolls = await enrollRes.json();
    if (!enrollRes.ok || enrolls.length === 0)
      return new Response(JSON.stringify({ error: "not enrolled" }), { status: 403 });

    // check if already used
    const usedRes = await fetch(
      `${supabaseUrl}/rest/v1/submission_tokens?session_id=eq.${sessionId}&student_id=eq.${user.id}&used=eq.true`,
      {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      },
    );
    const usedRows = await usedRes.json();
    if (usedRows.length > 0)
      return new Response(JSON.stringify({ error: "already_submitted" }), { status: 403 });

    // generate token, hash and upsert
    const tokenPlain = genToken();
    const tokenHash = hashToken(tokenPlain, serverSalt);
    // upsert: delete older unused tokens for same student+session, then insert
    await fetch(`${supabaseUrl}/rest/v1/submission_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        token_hash: tokenHash,
        student_id: user.id,
        used: false,
      }),
    });

    return new Response(JSON.stringify({ token: tokenPlain, expiresAt: session.ends_at }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
