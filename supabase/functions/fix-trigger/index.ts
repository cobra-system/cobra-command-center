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
    const client = new Client(dbUrl);
    await client.connect();

    const results: string[] = [];

    // Step 1: Check current trigger function
    const triggerCheck = await client.queryObject<{ prosrc: string }>(
      `SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'`
    );
    results.push(`Current trigger source: ${triggerCheck.rows[0]?.prosrc || "NOT FOUND"}`);

    // Step 2: Check profiles table columns
    const cols = await client.queryObject<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' ORDER BY ordinal_position`
    );
    results.push(`Profiles columns: ${cols.rows.map(r => r.column_name).join(", ")}`);

    // Step 3: Fix the trigger function to match our schema (id, name, role, pin)
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
    results.push("Trigger function fixed with ON CONFLICT DO NOTHING");

    // Step 4: Ensure the trigger exists on auth.users
    const triggerExists = await client.queryObject<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created'`
    );
    if (triggerExists.rows.length === 0) {
      await client.queryObject(`
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      `);
      results.push("Trigger created on auth.users");
    } else {
      results.push("Trigger already exists on auth.users");
    }

    // Step 5: Ensure extensions exist
    await client.queryObject(`CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions`);
    results.push("pgcrypto extension ensured");

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
