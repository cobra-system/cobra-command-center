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
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(externalUrl, externalKey);

    const results: string[] = [];

    // Users to fix
    const USERS = [
      { email: "noam@cobra.co.il", password: "cobra2026", name: "נועם", role: "MANAGER" },
      { email: "georgi@cobra.co.il", password: "cobra1111", name: "גיאורגי גריגוריאנץ", role: "WAREHOUSE_MANAGER" },
      { email: "ziv@cobra.co.il", password: "cobra2222", name: "זיו בוזגלו", role: "LOGISTICS" },
    ];

    for (const u of USERS) {
      // Try to delete existing user first
      const { data: listData } = await admin.auth.admin.listUsers();
      const existing = listData?.users?.find(x => x.email === u.email);
      
      if (existing) {
        const { error: delErr } = await admin.auth.admin.deleteUser(existing.id);
        if (delErr) {
          results.push(`Error deleting ${u.email}: ${delErr.message}`);
        } else {
          results.push(`Deleted old ${u.email} (${existing.id})`);
        }
      }

      // Create fresh user via Admin API
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role },
      });

      if (createErr) {
        results.push(`Error creating ${u.email}: ${createErr.message}`);
      } else {
        results.push(`Created ${u.email} with id=${newUser.user.id}`);
        
        // Update profile to correct role
        const { error: profileErr } = await admin.from("profiles").upsert({
          id: newUser.user.id,
          name: u.name,
          role: u.role,
        });
        if (profileErr) {
          results.push(`Profile error for ${u.email}: ${profileErr.message}`);
        } else {
          results.push(`Profile set for ${u.email}: ${u.role}`);
        }
      }
    }

    // Test login
    for (const u of USERS) {
      const resp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": externalKey },
        body: JSON.stringify({ email: u.email, password: u.password }),
      });
      const body = await resp.text();
      results.push(`Login ${u.email}: status=${resp.status} ${body.substring(0, 100)}`);
    }

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
