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
    
    const url = new URL(dbUrl);
    const client = new Client({
      hostname: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
      password: decodeURIComponent(url.password),
      tls: { enabled: true, enforce: false },
    });
    await client.connect();

    const results: string[] = [];

    // Check for soft-deleted auth users
    const softDeleted = await client.queryObject<{ id: string; email: string; deleted_at: string }>(
      `SELECT id, email, deleted_at FROM auth.users WHERE deleted_at IS NOT NULL`
    );
    results.push(`Soft-deleted auth users: ${softDeleted.rows.length}`);
    for (const u of softDeleted.rows) {
      results.push(`  Deleted: ${u.email} id=${u.id} deleted_at=${u.deleted_at}`);
    }

    // Check all auth users (including soft-deleted)
    const allAuth = await client.queryObject<{ id: string; email: string; deleted_at: string | null }>(
      `SELECT id, email, deleted_at FROM auth.users`
    );
    results.push(`Total auth users (including deleted): ${allAuth.rows.length}`);
    for (const u of allAuth.rows) {
      results.push(`  Auth: ${u.email} deleted=${u.deleted_at || 'no'}`);
    }

    // Hard-delete soft-deleted users
    if (softDeleted.rows.length > 0) {
      // First remove their identities
      await client.queryObject(
        `DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE deleted_at IS NOT NULL)`
      );
      // Then hard-delete
      const deleteResult = await client.queryObject(
        `DELETE FROM auth.users WHERE deleted_at IS NOT NULL`
      );
      results.push(`Hard-deleted ${softDeleted.rows.length} soft-deleted users`);
    }

    // Delete orphan profiles (profiles without auth users)
    const orphans = await client.queryObject<{ id: string; name: string }>(
      `SELECT p.id, p.name FROM public.profiles p LEFT JOIN auth.users u ON p.id = u.id WHERE u.id IS NULL`
    );
    results.push(`Orphan profiles: ${orphans.rows.length}`);
    for (const o of orphans.rows) {
      results.push(`  Orphan: ${o.name} (${o.id})`);
      // Delete user_roles for orphans
      await client.queryObject(`DELETE FROM public.user_roles WHERE user_id = $1`, [o.id]);
      // Delete tasks assigned to orphans  
      await client.queryObject(`UPDATE public.tasks SET assignee_id = NULL WHERE assignee_id = $1`, [o.id]);
      // Delete profile
      await client.queryObject(`DELETE FROM public.profiles WHERE id = $1`, [o.id]);
      results.push(`    Deleted orphan profile and roles`);
    }

    // Check for any email conflicts
    const emailConflicts = await client.queryObject<{ email: string }>(
      `SELECT email FROM auth.users WHERE email IN ('noam@cobra.co.il', 'georgi@cobra.co.il', 'ziv@cobra.co.il')`
    );
    results.push(`Email conflicts remaining: ${emailConflicts.rows.length}`);

    await client.end();

    // Now try creating users via Supabase Admin API
    const supabaseAdmin = createClient(externalUrl, externalServiceKey);

    const USERS = [
      { email: "noam@cobra.co.il", password: "cobra2026", name: "נועם", role: "MANAGER", pin: "1234" },
      { email: "georgi@cobra.co.il", password: "cobra1111", name: "גיאורגי גריגוריאנץ", role: "WAREHOUSE_MANAGER", pin: "1111" },
      { email: "ziv@cobra.co.il", password: "cobra2222", name: "זיו בוזגלו", role: "LOGISTICS", pin: "2222" },
    ];

    for (const u of USERS) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role },
      });

      if (createError || !newUser?.user) {
        results.push(`${u.name}: CREATE FAILED - ${createError?.message || "unknown"}`);
        continue;
      }

      const userId = newUser.user.id;
      results.push(`${u.name}: Created (${userId})`);

      // Update profile with PIN
      const { error: profError } = await supabaseAdmin.from("profiles").upsert(
        { id: userId, name: u.name, role: u.role, pin: u.pin },
        { onConflict: "id" }
      );
      results.push(`  Profile: ${profError?.message || "OK"}`);

      // Add user role
      const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: u.role },
        { onConflict: "user_id,role" }
      );
      results.push(`  Role: ${roleError?.message || "OK"}`);
    }

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
