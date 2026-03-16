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

    // Add document_name column if not exists
    await client.queryObject(`
      ALTER TABLE public.purchase_documents ADD COLUMN IF NOT EXISTS document_name text;
    `);
    results.push("Added document_name column");

    // Remove type check constraint if exists
    await client.queryObject(`
      ALTER TABLE public.purchase_documents DROP CONSTRAINT IF EXISTS purchase_documents_type_check;
    `);
    results.push("Removed type check constraint");

    // Set default for quantity
    await client.queryObject(`
      ALTER TABLE public.purchase_documents ALTER COLUMN quantity SET DEFAULT 0;
    `);
    results.push("Set quantity default to 0");

    await client.end();

    return new Response(JSON.stringify({ success: true, results }, null, 2), {
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
