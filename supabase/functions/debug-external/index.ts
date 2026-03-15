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
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Check raw_app_meta_data for each user
    const users = await client.queryObject<{ 
      id: string; email: string; raw_app_meta_data: any; raw_user_meta_data: any; confirmed_at: string | null
    }>(
      `SELECT id, email, raw_app_meta_data, raw_user_meta_data, confirmed_at FROM auth.users WHERE deleted_at IS NULL`
    );
    
    for (const u of users.rows) {
      results.push(`${u.email}: app_meta=${JSON.stringify(u.raw_app_meta_data)} user_meta=${JSON.stringify(u.raw_user_meta_data)} confirmed=${u.confirmed_at}`);
    }

    // Fix raw_app_meta_data - GoTrue needs this
    for (const u of users.rows) {
      await client.queryObject(
        `UPDATE auth.users SET 
          raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
          updated_at = now()
        WHERE id = '${u.id}'::uuid`
      );
      results.push(`Fixed app_meta for ${u.email}`);
    }

    await client.end();

    // Now test GoTrue sign-in directly
    const gotrueResp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": externalServiceKey,
      },
      body: JSON.stringify({ email: "georgi@cobra.co.il", password: "cobra1111" }),
    });
    
    const body = await gotrueResp.text();
    results.push(`\nGoTrue sign-in status: ${gotrueResp.status}`);
    results.push(`GoTrue response: ${body.substring(0, 500)}`);

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
