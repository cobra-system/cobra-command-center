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
    // Use Lovable Cloud's own Supabase (internal project)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const results: string[] = [];

    const USERS = [
      { email: "noam@cobra.co.il", password: "cobra2026", name: "נועם", role: "MANAGER" },
      { email: "georgi@cobra.co.il", password: "cobra1111", name: "גיאורגי גריגוריאנץ", role: "WAREHOUSE_MANAGER" },
      { email: "ziv@cobra.co.il", password: "cobra2222", name: "זיו בוזגלו", role: "LOGISTICS" },
    ];

    for (const u of USERS) {
      // Check if user exists
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = listData?.users?.find((eu: any) => eu.email === u.email);

      if (existing) {
        // Update password and confirm
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: u.password,
          email_confirm: true,
        });
        if (updateErr) {
          results.push(`❌ Error updating ${u.email}: ${updateErr.message}`);
        } else {
          results.push(`✅ Updated ${u.email} (id: ${existing.id})`);
        }
        // Ensure profile
        await supabaseAdmin.from("profiles").upsert(
          { id: existing.id, name: u.name, role: u.role },
          { onConflict: "id" }
        );
      } else {
        // Create new user
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name, role: u.role },
        });
        if (createErr) {
          results.push(`❌ Error creating ${u.email}: ${createErr.message}`);
        } else {
          results.push(`✅ Created ${u.email} (id: ${newUser?.user?.id})`);
        }
      }
    }

    // Test login for each
    for (const u of USERS) {
      const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": serviceKey },
        body: JSON.stringify({ email: u.email, password: u.password }),
      });
      const body = await resp.json();
      if (resp.ok && body.access_token) {
        results.push(`✅ Login test OK: ${u.email}`);
      } else {
        results.push(`❌ Login test FAILED: ${u.email} - ${body.error_description || JSON.stringify(body)}`);
      }
    }

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
