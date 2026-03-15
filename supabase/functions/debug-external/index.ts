import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

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
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(externalUrl, externalServiceKey);

    const results: Record<string, any> = {};

    // Step 1: Create a temporary RPC function to inspect the trigger
    const createInspectorFn = await fetch(`${externalUrl}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": externalServiceKey,
        "Authorization": `Bearer ${externalServiceKey}`,
      },
    });

    // Use the SQL endpoint to run queries
    // Supabase exposes pg_net or we can use the /sql endpoint if available
    // Let's try the Supabase Management API approach via direct pg connection

    // Alternative: Create a helper function via supabaseAdmin
    // First, let's try to create a simple RPC that returns the trigger source
    const sqlUrl = `${externalUrl}/rest/v1/`;
    
    // Actually, let's try to fix the trigger by creating a new version of handle_new_user
    // that only uses columns we KNOW exist (id, name, role)
    // We can do this by creating an RPC function that creates the fix

    // Create a temporary function to get trigger info and fix it
    const { data: createFnResult, error: createFnError } = await supabaseAdmin.rpc(
      "create_fix_trigger_fn", {}
    );
    results.createFn = createFnResult || createFnError?.message || "no such rpc";

    // Since we can't run arbitrary SQL via PostgREST, let's use a different approach:
    // Use the Supabase Database REST endpoint with service role
    // The /pg endpoint or similar
    
    // Let's try the supabase-js SQL method if available
    // Actually in supabase-js v2 there's no direct SQL execution
    
    // Let's try creating a function via PostgREST by calling an existing function
    // that can create other functions (this won't work either)

    // The real solution: We need to execute SQL on the external database.
    // Options:
    // 1. Use the Supabase Management API (requires management API key, not service role key)
    // 2. Connect directly to the database via pg connection string
    // 3. Ask user to run SQL in their Supabase dashboard

    // Let's try option 2 using Deno's postgres driver
    // But we need the DB connection string for the external project
    
    // Actually, let's try the external project's SQL execution endpoint
    const sqlResp = await fetch(`${externalUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": externalServiceKey,
        "Authorization": `Bearer ${externalServiceKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        query: "SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'"
      }),
    });
    results.execSqlStatus = sqlResp.status;
    results.execSqlBody = await sqlResp.text();

    return new Response(JSON.stringify(results, null, 2), {
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
