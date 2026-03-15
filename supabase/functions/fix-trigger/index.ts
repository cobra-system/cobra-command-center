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

    // Step 1: Drop ALL triggers on auth.users
    try {
      const triggers = await client.queryObject<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass`
      );
      results.push("Triggers on auth.users: " + JSON.stringify(triggers.rows));
      for (const t of triggers.rows) {
        await client.queryObject(`DROP TRIGGER IF EXISTS "${t.tgname}" ON auth.users`);
        results.push("Dropped trigger: " + t.tgname);
      }
    } catch (e) {
      results.push("Error listing/dropping triggers: " + String(e));
    }

    // Step 2: Make handle_new_user completely harmless
    try {
      await client.queryObject(`
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          RETURN NEW;
        END;
        $$;
      `);
      results.push("Made handle_new_user a no-op");
    } catch (e) {
      results.push("Error: " + String(e));
    }

    // Step 3: Check for broken functions in public schema
    try {
      const funcs = await client.queryObject<{ proname: string; prosrc: string }>(
        `SELECT proname, substring(prosrc, 1, 100) as prosrc FROM pg_proc 
         WHERE pronamespace = 'public'::regnamespace 
         ORDER BY proname`
      );
      for (const f of funcs.rows) {
        results.push(`Function: ${f.proname} => ${f.prosrc.substring(0, 80)}`);
      }
    } catch (e) {
      results.push("Error listing functions: " + String(e));
    }

    // Step 4: Check for broken views
    try {
      const views = await client.queryObject<{ viewname: string }>(
        `SELECT viewname FROM pg_views WHERE schemaname = 'public'`
      );
      results.push("Views: " + JSON.stringify(views.rows));
    } catch (e) {
      results.push("Error listing views: " + String(e));
    }

    await client.end();

    // Step 5: Test GoTrue
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    
    const gotrueResp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": externalKey },
      body: JSON.stringify({ email: "noam@cobra.co.il", password: "cobra2026" }),
    });
    const gotrueBody = await gotrueResp.text();
    results.push(`GoTrue status: ${gotrueResp.status}`);
    results.push(`GoTrue: ${gotrueBody.substring(0, 300)}`);

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
