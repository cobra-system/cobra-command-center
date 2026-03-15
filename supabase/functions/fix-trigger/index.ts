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

    // Check event triggers
    try {
      const eventTriggers = await client.queryObject<{ evtname: string; evtfoid: string; evtevent: string }>(
        `SELECT evtname, evtfoid::regproc as evtfoid, evtevent FROM pg_event_trigger`
      );
      results.push("Event triggers: " + JSON.stringify(eventTriggers.rows));
      
      // Drop all event triggers
      for (const et of eventTriggers.rows) {
        try {
          await client.queryObject(`DROP EVENT TRIGGER IF EXISTS "${et.evtname}"`);
          results.push("Dropped event trigger: " + et.evtname);
        } catch (e) {
          results.push("Error dropping event trigger " + et.evtname + ": " + String(e));
        }
      }
    } catch (e) {
      results.push("Error with event triggers: " + String(e));
    }

    // Check extensions
    try {
      const exts = await client.queryObject<{ extname: string }>(
        `SELECT extname FROM pg_extension ORDER BY extname`
      );
      results.push("Extensions: " + JSON.stringify(exts.rows.map(e => e.extname)));
    } catch (e) {
      results.push("Error listing extensions: " + String(e));
    }

    // Check if there are any broken objects in public schema
    try {
      const types = await client.queryObject<{ typname: string }>(
        `SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'`
      );
      results.push("Custom enums: " + JSON.stringify(types.rows));
    } catch (e) {
      results.push("Error listing types: " + String(e));
    }

    // Check triggers on auth.users remaining
    try {
      const triggers = await client.queryObject<{ tgname: string; tgtype: number; tgenabled: string }>(
        `SELECT tgname, tgtype, tgenabled FROM pg_trigger 
         WHERE tgrelid = 'auth.users'::regclass AND tgname NOT LIKE 'RI_%'`
      );
      results.push("Custom triggers on auth.users: " + JSON.stringify(triggers.rows));
    } catch (e) {
      results.push("Error: " + String(e));
    }

    // Check search_path
    try {
      const sp = await client.queryObject<{ search_path: string }>(`SHOW search_path`);
      results.push("search_path: " + JSON.stringify(sp.rows));
    } catch (e) {
      results.push("Error: " + String(e));
    }

    await client.end();

    // Test GoTrue
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    
    const gotrueResp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": externalKey },
      body: JSON.stringify({ email: "noam@cobra.co.il", password: "cobra2026" }),
    });
    const gotrueBody = await gotrueResp.text();
    results.push(`GoTrue: status=${gotrueResp.status} body=${gotrueBody.substring(0, 300)}`);

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
