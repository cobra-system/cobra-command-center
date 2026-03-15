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

    // Check for locks
    const locks = await client.queryObject<{ pid: number; state: string; query: string; wait_event: string | null }>(
      `SELECT pid, state, substring(query, 1, 200) as query, wait_event_type || ':' || wait_event as wait_event
       FROM pg_stat_activity WHERE datname = current_database() AND state != 'idle' AND pid != pg_backend_pid()
       LIMIT 20`
    );
    results.push("Active queries: " + JSON.stringify(locks.rows));

    // Check if there are locked tables
    const tableLocks = await client.queryObject(
      `SELECT l.relation::regclass as table, l.mode, l.granted, a.state, substring(a.query,1,100) as query
       FROM pg_locks l JOIN pg_stat_activity a ON l.pid = a.pid
       WHERE l.relation IS NOT NULL AND NOT l.granted
       LIMIT 10`
    );
    results.push("Ungranted locks: " + JSON.stringify(tableLocks.rows));

    // Try direct query as GoTrue would
    try {
      const test = await client.queryObject(
        `SELECT id, email FROM auth.users WHERE email = 'noam@cobra.co.il' LIMIT 1`
      );
      results.push("Direct query works: " + JSON.stringify(test.rows));
    } catch (e) {
      results.push("Direct query FAILED: " + String(e));
    }

    // Check if there's an issue with the supabase_auth_admin role
    try {
      const authRole = await client.queryObject(
        `SELECT rolname, rolsuper, rolcreaterole FROM pg_roles WHERE rolname = 'supabase_auth_admin'`
      );
      results.push("Auth admin role: " + JSON.stringify(authRole.rows));
    } catch (e) {
      results.push("Error checking auth role: " + String(e));
    }

    // Check if search_path for supabase_auth_admin is correct
    try {
      const sp = await client.queryObject(
        `SELECT usename, useconfig FROM pg_user WHERE usename = 'supabase_auth_admin'`
      );
      results.push("Auth admin config: " + JSON.stringify(sp.rows));
    } catch (e) {
      results.push("Error: " + String(e));
    }

    // Try to recreate the trigger - maybe GoTrue NEEDS it
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
      await client.queryObject(`
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
      `);
      results.push("Recreated trigger with exception handler");
    } catch (e) {
      results.push("Error recreating trigger: " + String(e));
    }

    // Recreate the ensure_rls event trigger that was dropped
    try {
      await client.queryObject(`
        CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
        EXECUTE FUNCTION rls_auto_enable();
      `);
      results.push("Recreated ensure_rls event trigger");
    } catch (e) {
      results.push("Error recreating ensure_rls: " + String(e));
    }

    // Check GoTrue health endpoint
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const healthResp = await fetch(`${externalUrl}/auth/v1/health`);
    const healthBody = await healthResp.text();
    results.push(`GoTrue health: status=${healthResp.status} body=${healthBody}`);

    await client.end();

    // Test login again
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const loginResp = await fetch(`${externalUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": externalKey },
      body: JSON.stringify({ email: "noam@cobra.co.il", password: "cobra2026" }),
    });
    results.push(`Login test: status=${loginResp.status} body=${(await loginResp.text()).substring(0, 200)}`);

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
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
