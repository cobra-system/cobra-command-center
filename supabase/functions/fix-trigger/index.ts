import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
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
    const supabaseAdmin = createClient(externalUrl, externalServiceKey);

    // Get existing auth users from DB directly
    const authUsers = await client.queryObject<{ id: string; email: string }>(
      `SELECT id, email FROM auth.users WHERE deleted_at IS NULL`
    );
    results.push(`Auth users found: ${authUsers.rows.length}`);

    const USERS = [
      { email: "noam@cobra.co.il", password: "cobra2026", name: "נועם", role: "MANAGER", pin: "1234" },
      { email: "georgi@cobra.co.il", password: "cobra1111", name: "גיאורגי גריגוריאנץ", role: "WAREHOUSE_MANAGER", pin: "1111" },
      { email: "ziv@cobra.co.il", password: "cobra2222", name: "זיו בוזגלו", role: "LOGISTICS", pin: "2222" },
    ];

    for (const u of USERS) {
      const authUser = authUsers.rows.find(a => a.email === u.email);
      if (!authUser) {
        results.push(`${u.name}: No auth user found for ${u.email}`);
        continue;
      }

      const userId = authUser.id;
      results.push(`${u.name}: Found auth user ${userId}`);

      // Update password and confirm email via admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role },
      });
      results.push(`  Password update: ${updateError?.message || "OK"}`);

      // Upsert profile with plaintext PIN
      const { error: profError } = await supabaseAdmin.from("profiles").upsert(
        { id: userId, name: u.name, role: u.role, pin: u.pin },
        { onConflict: "id" }
      );
      results.push(`  Profile: ${profError?.message || "OK"}`);

      // Upsert user role
      const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: u.role },
        { onConflict: "user_id,role" }
      );
      results.push(`  Role: ${roleError?.message || "OK"}`);
    }

    // Verify profiles
    const profiles = await client.queryObject<{ id: string; name: string; role: string; pin: string }>(
      `SELECT id, name, role, pin FROM public.profiles`
    );
    results.push(`\nFinal profiles:`);
    for (const p of profiles.rows) {
      results.push(`  ${p.name} (${p.role}) pin=${p.pin || "NULL"}`);
    }

    await client.end();

    return new Response(JSON.stringify({ success: true, results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), stack: (err as Error).stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
