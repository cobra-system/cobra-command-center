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

    // Check auth.identities columns
    const idCols = await client.queryObject<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'identities' ORDER BY ordinal_position`
    );
    results.push("auth.identities columns:");
    for (const c of idCols.rows) {
      results.push(`  ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}`);
    }

    // Check actual identity data
    const identityData = await client.queryObject(
      `SELECT * FROM auth.identities LIMIT 3`
    );
    results.push(`\nIdentity rows: ${identityData.rows.length}`);
    for (const row of identityData.rows) {
      results.push(`  ${JSON.stringify(row)}`);
    }

    // Check auth.users full structure
    const userCols = await client.queryObject<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' ORDER BY ordinal_position`
    );
    results.push("\nauth.users columns:");
    for (const c of userCols.rows) {
      results.push(`  ${c.column_name} (${c.data_type})`);
    }

    // Check auth schema version
    const migrations = await client.queryObject<{ version: string }>(
      `SELECT version FROM auth.schema_migrations ORDER BY version DESC LIMIT 5`
    );
    results.push("\nAuth schema versions (latest 5):");
    for (const m of migrations.rows) {
      results.push(`  ${m.version}`);
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
