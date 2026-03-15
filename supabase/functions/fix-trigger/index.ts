import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dbUrl = Deno.env.get("EXTERNAL_DB_URL")!;
    const parsedUrl = new URL(dbUrl);
    const client = new Client({
      hostname: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 5432,
      database: parsedUrl.pathname.slice(1),
      user: parsedUrl.username,
      password: decodeURIComponent(parsedUrl.password),
      tls: { enabled: true, enforce: false },
    });
    await client.connect();

    const results: string[] = [];

    // Drop ONLY the on_auth_user_created trigger
    await client.queryObject(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`);
    results.push("Dropped on_auth_user_created");

    // Verify it's gone
    const remaining = await client.queryObject<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname NOT LIKE 'RI_%'`
    );
    results.push("Remaining custom triggers: " + JSON.stringify(remaining.rows));

    // Also check if there are any triggers on profiles table that might cause issues
    try {
      const profTriggers = await client.queryObject<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND tgname NOT LIKE 'RI_%'`
      );
      results.push("Triggers on profiles: " + JSON.stringify(profTriggers.rows));
    } catch (e) {
      results.push("No triggers on profiles or error: " + String(e));
    }

    // Check RLS policies on profiles - maybe one is broken
    try {
      const policies = await client.queryObject<{ polname: string; polcmd: string; polqual: string }>(
        `SELECT polname, polcmd::text, pg_get_expr(polqual, polrelid) as polqual 
         FROM pg_policy WHERE polrelid = 'public.profiles'::regclass`
      );
      results.push("Profiles RLS policies: " + JSON.stringify(policies.rows));
    } catch (e) {
      results.push("Error: " + String(e));
    }

    // Try to disable RLS on profiles temporarily to test
    try {
      // Check if RLS is enabled
      const rlsCheck = await client.queryObject<{ relrowsecurity: boolean }>(
        `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass`
      );
      results.push("Profiles RLS enabled: " + rlsCheck.rows[0]?.relrowsecurity);
    } catch (e) {
      results.push("Error: " + String(e));
    }

    // Check if login_by_pin or other functions use search_path that's broken
    try {
      const funcDetails = await client.queryObject<{ proname: string; proconfig: string[] | null }>(
        `SELECT proname, proconfig FROM pg_proc WHERE pronamespace = 'public'::regnamespace`
      );
      for (const f of funcDetails.rows) {
        results.push(`Func ${f.proname}: config=${JSON.stringify(f.proconfig)}`);
      }
    } catch (e) {
      results.push("Error: " + String(e));
    }

    await client.end();

    // Test GoTrue immediately after dropping trigger
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    
    const gotrueResp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": externalKey },
      body: JSON.stringify({ email: "noam@cobra.co.il", password: "cobra2026" }),
    });
    const gotrueBody = await gotrueResp.text();
    results.push(`GoTrue: status=${gotrueResp.status}`);
    results.push(`GoTrue: ${gotrueBody.substring(0, 500)}`);

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
  }
});
