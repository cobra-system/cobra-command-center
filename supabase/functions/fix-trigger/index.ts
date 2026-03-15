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

    // Step 1: Drop problematic trigger
    try {
      await client.queryObject(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`);
      results.push("Dropped trigger on_auth_user_created");
    } catch (e) {
      results.push("Error dropping trigger: " + String(e));
    }

    // Step 2: Recreate simpler function
    try {
      await client.queryObject(`
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = 'public'
        AS $$
        BEGIN
          INSERT INTO public.profiles (id, name, role)
          VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'MANAGER'::app_role)
          )
          ON CONFLICT (id) DO NOTHING;
          RETURN NEW;
        EXCEPTION WHEN OTHERS THEN
          RETURN NEW;
        END;
        $$;
      `);
      results.push("Recreated handle_new_user with exception handler");
    } catch (e) {
      results.push("Error creating function: " + String(e));
    }

    // Step 3: Recreate trigger
    try {
      await client.queryObject(`
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
      `);
      results.push("Recreated trigger");
    } catch (e) {
      results.push("Error creating trigger: " + String(e));
    }

    // Step 4: Ensure noam profile is MANAGER
    try {
      const noamUpdate = await client.queryObject(
        `UPDATE public.profiles SET role = 'MANAGER' WHERE id IN (
          SELECT id FROM auth.users WHERE email = 'noam@cobra.co.il' AND deleted_at IS NULL
        )`
      );
      results.push("Updated noam to MANAGER");
    } catch (e) {
      results.push("Error updating noam: " + String(e));
    }

    // Step 5: List current state
    const profiles = await client.queryObject<{ id: string; name: string; role: string }>(
      `SELECT id, name, role FROM public.profiles ORDER BY name`
    );
    results.push("Profiles: " + JSON.stringify(profiles.rows));

    const users = await client.queryObject<{ id: string; email: string }>(
      `SELECT id, email FROM auth.users WHERE deleted_at IS NULL`
    );
    results.push("Auth users: " + JSON.stringify(users.rows));

    await client.end();

    // Step 6: Test GoTrue login
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    
    const gotrueResp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": externalKey },
      body: JSON.stringify({ email: "noam@cobra.co.il", password: "cobra2026" }),
    });
    const gotrueBody = await gotrueResp.text();
    results.push(`GoTrue login test: status=${gotrueResp.status}`);
    results.push(`GoTrue response: ${gotrueBody.substring(0, 300)}`);

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
