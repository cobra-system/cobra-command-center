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

    // Check user details
    const users = await client.queryObject<{ 
      id: string; email: string; encrypted_password: string; 
      email_confirmed_at: string | null; is_sso_user: boolean;
      instance_id: string; aud: string;
    }>(
      `SELECT id, email, substring(encrypted_password, 1, 20) as encrypted_password, 
              email_confirmed_at, is_sso_user, instance_id, aud 
       FROM auth.users WHERE deleted_at IS NULL`
    );
    
    for (const u of users.rows) {
      results.push(`User: ${u.email} id=${u.id}`);
      results.push(`  confirmed=${u.email_confirmed_at} sso=${u.is_sso_user} instance=${u.instance_id} aud=${u.aud}`);
      results.push(`  pwd_prefix=${u.encrypted_password}`);
    }

    // Check if instance_id is the issue - GoTrue expects specific instance_id
    // Fix: ensure instance_id is the default '00000000-0000-0000-0000-000000000000'
    const USERS = [
      { email: "noam@cobra.co.il", password: "cobra2026" },
      { email: "georgi@cobra.co.il", password: "cobra1111" },
      { email: "ziv@cobra.co.il", password: "cobra2222" },
    ];

    for (const u of USERS) {
      // Update password using bcrypt, confirm email, fix instance_id
      await client.queryObject(
        `UPDATE auth.users SET 
          encrypted_password = crypt($1, gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          instance_id = '00000000-0000-0000-0000-000000000000',
          aud = 'authenticated',
          role = 'authenticated',
          updated_at = now()
        WHERE email = $2`,
        [u.password, u.email]
      );
      results.push(`Updated password for ${u.email}`);
    }

    // Verify identities exist
    const identities = await client.queryObject<{ user_id: string; provider: string }>(
      `SELECT user_id, provider FROM auth.identities`
    );
    results.push(`\nIdentities: ${identities.rows.length}`);
    for (const i of identities.rows) {
      results.push(`  ${i.user_id} - ${i.provider}`);
    }

    // If any user is missing email identity, create it
    for (const authUser of users.rows) {
      const hasIdentity = identities.rows.some(i => i.user_id === authUser.id);
      if (!hasIdentity) {
        const uid = authUser.id;
        const uemail = authUser.email;
        await client.queryObject(
          `INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
           VALUES (gen_random_uuid(), '${uid}'::uuid, '${uid}', 'email', '{"sub":"${uid}","email":"${uemail}"}'::jsonb, now(), now(), now())`
        );
        results.push(`Created email identity for ${authUser.email}`);
      }
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
