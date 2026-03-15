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
    const results: string[] = [];
    
    // Log masked URL for debugging
    const masked = dbUrl.replace(/:([^@]+)@/, ":***@");
    results.push(`DB URL (masked): ${masked}`);
    results.push(`URL length: ${dbUrl.length}`);
    
    // Try parsing and connecting with explicit params
    const url = new URL(dbUrl);
    results.push(`Host: ${url.hostname}`);
    results.push(`Port: ${url.port}`);
    results.push(`Database: ${url.pathname.slice(1)}`);
    results.push(`User: ${url.username}`);
    results.push(`Password length: ${url.password.length}`);
    
    const client = new Client({
      hostname: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
      password: decodeURIComponent(url.password),
      tls: { enabled: true, enforce: false },
    });
    
    await client.connect();
    results.push("Connected successfully!");

    // Fix the trigger function
    const triggerCheck = await client.queryObject<{ prosrc: string }>(
      `SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'`
    );
    results.push(`Current trigger found: ${triggerCheck.rows.length > 0}`);
    if (triggerCheck.rows[0]) {
      results.push(`Trigger source: ${triggerCheck.rows[0].prosrc.substring(0, 200)}`);
    }

    // Check profiles columns
    const cols = await client.queryObject<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' ORDER BY ordinal_position`
    );
    results.push(`Profiles columns: ${cols.rows.map(r => r.column_name).join(", ")}`);

    // Fix trigger to use ON CONFLICT DO NOTHING
    await client.queryObject(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $$
      BEGIN
        INSERT INTO public.profiles (id, name, role)
        VALUES (
          NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
          COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'DRIVER')
        )
        ON CONFLICT (id) DO NOTHING;
        RETURN NEW;
      END;
      $$;
    `);
    results.push("Trigger function fixed!");

    // Ensure trigger exists
    const triggerExists = await client.queryObject<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created'`
    );
    results.push(`Trigger on auth.users exists: ${triggerExists.rows.length > 0}`);

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
