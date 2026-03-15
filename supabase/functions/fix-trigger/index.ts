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

    const results: string[] = [];

    // Step 1: Fix the handle_new_user trigger via RPC or direct SQL
    // We'll use the admin client to call a raw SQL function
    // Since we can't run raw SQL via client, we fix it by ensuring profiles exist

    // Step 2: Create/update users
    const USERS = [
      { email: "noam@cobra.co.il", password: "cobra2026", name: "נועם", role: "MANAGER" },
      { email: "georgi@cobra.co.il", password: "cobra1111", name: "גיאורגי גריגוריאנץ", role: "WAREHOUSE_MANAGER" },
      { email: "ziv@cobra.co.il", password: "cobra2222", name: "זיו בוזגלו", role: "LOGISTICS" },
    ];

    for (const u of USERS) {
      // Try to get existing user by email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);

      if (existing) {
        // Update password
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: u.password,
          email_confirm: true,
        });
        if (updateErr) {
          results.push(`Error updating ${u.email}: ${updateErr.message}`);
        } else {
          results.push(`Updated ${u.email} (id: ${existing.id})`);
        }

        // Ensure profile exists
        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .upsert({ id: existing.id, name: u.name, role: u.role }, { onConflict: "id" });
        if (profileErr) {
          results.push(`Profile error for ${u.email}: ${profileErr.message}`);
        }
      } else {
        // Create new user
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name, role: u.role },
        });
        if (createErr) {
          results.push(`Error creating ${u.email}: ${createErr.message}`);
        } else if (newUser?.user) {
          results.push(`Created ${u.email} (id: ${newUser.user.id})`);
          // Insert profile
          const { error: profileErr } = await supabaseAdmin
            .from("profiles")
            .upsert({ id: newUser.user.id, name: u.name, role: u.role }, { onConflict: "id" });
          if (profileErr) {
            results.push(`Profile error for ${u.email}: ${profileErr.message}`);
          }
        }
      }
    }

    // Step 3: Verify - try signing in with each user
    for (const u of USERS) {
      const resp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": externalServiceKey },
        body: JSON.stringify({ email: u.email, password: u.password }),
      });
      const body = await resp.json();
      if (resp.ok && body.access_token) {
        results.push(`✅ Login test OK for ${u.email}`);
      } else {
        results.push(`❌ Login test FAILED for ${u.email}: ${body.error_description || body.msg || JSON.stringify(body)}`);
      }
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
