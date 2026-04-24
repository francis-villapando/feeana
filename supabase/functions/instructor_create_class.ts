import { serve } from "std/server";
import { hashToken, genToken } from "./helpers";

// Minimal instructor create class function
serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const body = await req.json();
    const { course, section, name, topics, ilos } = body;
    if (!course || !section) {
      return new Response(JSON.stringify({ error: "course and section required" }), { status: 400 });
    }

    // verify auth token and role (simple check via supabase / user info)
    const auth = req.headers.get("authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

    // call supabase REST to get user
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: auth },
    });
    if (!userRes.ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    const user = await userRes.json();

    // For MVP we allow any authenticated user to create class as instructor
    // Ensure profile exists; insert if needed
    const profileResp = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&eq.id=${user.id}`, {
      headers: { Authorization: `Bearer ${serviceKey}`, "apikey": serviceKey },
    });

    // create a join code (8 chars)
    const joinCode = makeJoinCode();

    // insert class
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/classes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ instructor_id: user.id, course, section, name, join_code: joinCode, topics: topics || [], ilos: ilos || [] }),
    });
    const insertJson = await insertRes.json();
    if (!insertRes.ok) return new Response(JSON.stringify({ error: insertJson }), { status: 500 });
    return new Response(JSON.stringify({ id: insertJson[0].id, joinCode }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

function makeJoinCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
