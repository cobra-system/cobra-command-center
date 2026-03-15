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

    // Check triggers on auth.users
    const { data: triggers, error: trigErr } = await supabaseAdmin.rpc("get_triggers_info").maybeSingle();
    results.triggersRpc = triggers || trigErr?.message || "no rpc";

    // Try raw query for trigger info via PostgREST - won't work, need different approach
    // Let's check the profiles table schema
    const { data: profilesCols, error: colErr } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .limit(0);
    results.profilesQuery = colErr?.message || "OK";

    // Try to insert a profile directly to test
    const testId = "00000000-0000-0000-0000-000000000099";
    const { error: insertErr } = await supabaseAdmin
      .from("profiles")
      .insert({ id: testId, name: "TEST", role: "DRIVER" });
    results.directInsert = insertErr?.message || "OK";

    // Clean up test
    if (!insertErr) {
      await supabaseAdmin.from("profiles").delete().eq("id", testId);
      results.cleanup = "deleted test profile";
    }

    // Check what columns the profiles table has by inserting with extra fields
    const { error: emailInsertErr } = await supabaseAdmin
      .from("profiles")
      .insert({ id: testId, name: "TEST2", role: "DRIVER", email: "test@test.com" });
    results.emailInsert = emailInsertErr?.message || "OK - email column exists";
    if (!emailInsertErr) {
      await supabaseAdmin.from("profiles").delete().eq("id", testId);
    }

    // Try to get the handle_new_user function definition
    const { data: fnDef, error: fnErr } = await supabaseAdmin
      .rpc("pg_get_functiondef", { function_name: "handle_new_user" });
    results.functionDef = fnDef || fnErr?.message || "no rpc available";

    // Try querying information_schema for triggers
    // This won't work via PostgREST but let's try pg_catalog approach
    // Actually, let's use the REST API to query pg_catalog
    const triggerResp = await fetch(
      `${externalUrl}/rest/v1/rpc/get_function_source`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": externalServiceKey,
          "Authorization": `Bearer ${externalServiceKey}`,
        },
        body: JSON.stringify({ fn_name: "handle_new_user" }),
      }
    );
    results.fnSourceStatus = triggerResp.status;
    results.fnSourceBody = await triggerResp.text();

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
