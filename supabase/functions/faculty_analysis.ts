import { serve } from "std/server";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const sessionId =
      parts[parts.length - 2] === "sessions" ? parts[parts.length - 1] : parts[parts.length - 1];

    // For MVP, return seeded mock analysis; insert into analysis_results
    const mock = {
      summary: "This is a mocked analysis result.",
      recommendations: [{ id: "r1", text: "Increase formative checks.", score: 0.9 }],
    };

    // insert mock
    await fetch(`${supabaseUrl}/rest/v1/analysis_results`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        result: mock,
        is_mock: true,
        model_version: "mock-v1",
      }),
    });

    return new Response(JSON.stringify(mock));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
