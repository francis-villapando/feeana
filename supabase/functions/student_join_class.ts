import { serve } from "std/server";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

    const body = await req.json();
    const { joinCode } = body;
    if (!joinCode)
      return new Response(JSON.stringify({ error: "joinCode required" }), { status: 400 });

    // get user
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: auth },
    });
    if (!userRes.ok)
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    const user = await userRes.json();

    // find class by join_code
    const classRes = await fetch(
      `${supabaseUrl}/rest/v1/classes?join_code=eq.${encodeURIComponent(joinCode)}`,
      {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      },
    );
    const classes = await classRes.json();
    if (!classRes.ok || classes.length === 0)
      return new Response(JSON.stringify({ error: "class not found" }), { status: 404 });
    const cls = classes[0];

    // create profile if not exists
    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: user.id, email: user.email, role: "student" }),
    });

    // upsert enrollment
    await fetch(`${supabaseUrl}/rest/v1/enrollments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ class_id: cls.id, student_id: user.id }),
    });

    return new Response(JSON.stringify({ classId: cls.id }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
