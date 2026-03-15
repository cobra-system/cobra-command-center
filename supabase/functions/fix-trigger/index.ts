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

    // Dump full auth.users data for noam
    const noam = await client.queryObject(
      `SELECT * FROM auth.users WHERE email = 'noam@cobra.co.il' AND deleted_at IS NULL`
    );
    if (noam.rows[0]) {
      const u = noam.rows[0] as any;
      for (const [k, v] of Object.entries(u)) {
        if (k === 'encrypted_password') {
          results.push(`  ${k}: ${String(v).substring(0, 10)}...`);
        } else {
          results.push(`  ${k}: ${JSON.stringify(v)}`);
        }
      }
    }

    // Compare with admin@cobra.io (which works)
    const admin = await client.queryObject(
      `SELECT * FROM auth.users WHERE email = 'admin@cobra.io' AND deleted_at IS NULL`
    );
    if (admin.rows[0]) {
      results.push("\n--- admin@cobra.io ---");
      const u = admin.rows[0] as any;
      for (const [k, v] of Object.entries(u)) {
        if (k === 'encrypted_password') {
          results.push(`  ${k}: ${String(v).substring(0, 10)}...`);
        } else {
          results.push(`  ${k}: ${JSON.stringify(v)}`);
        }
      }
    }

    // Check auth.identities for both
    const identities = await client.queryObject(
      `SELECT user_id, provider, provider_id, substring(identity_data::text, 1, 100) as identity_data 
       FROM auth.identities`
    );
    results.push("\n--- identities ---");
    for (const i of identities.rows) {
      results.push(JSON.stringify(i));
    }

    await client.end();

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
