const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

    const tests = [
      { email: "noam@cobra.co.il", password: "cobra2026" },
      { email: "georgi@cobra.co.il", password: "cobra1111" },
      { email: "ziv@cobra.co.il", password: "cobra2222" },
    ];

    const results: string[] = [];

    for (const t of tests) {
      const resp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": externalKey },
        body: JSON.stringify({ email: t.email, password: t.password }),
      });
      const body = await resp.json();
      if (resp.ok && body.access_token) {
        results.push(`✅ ${t.email} - OK (user_id: ${body.user?.id})`);
      } else {
        results.push(`❌ ${t.email} - FAILED: ${body.error_description || body.msg || JSON.stringify(body)}`);
      }
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
