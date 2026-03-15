import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map of PIN -> email/password for known users
const PIN_CREDENTIALS: Record<string, { email: string; password: string }> = {
  "1234": { email: "noam@cobra.co.il", password: "cobra2026" },
  "1111": { email: "georgi@cobra.co.il", password: "cobra1111" },
  "2222": { email: "ziv@cobra.co.il", password: "cobra2222" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();

    if (!pin || typeof pin !== "string" || pin.length !== 4) {
      return new Response(
        JSON.stringify({ error: "PIN חייב להיות 4 ספרות" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(externalUrl, externalServiceKey);

    // Step 1: Find profile by PIN
    let profile: any = null;
    const { data: plainMatch } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role, pin")
      .eq("pin", pin)
      .maybeSingle();

    if (plainMatch) {
      profile = plainMatch;
    } else {
      const { data: rpcResult } = await supabaseAdmin.rpc("login_by_pin", { input_pin: pin });
      if (rpcResult && rpcResult.length > 0) {
        profile = rpcResult[0];
      }
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "קוד PIN שגוי" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get email from DB directly
    const dbUrl = Deno.env.get("EXTERNAL_DB_URL");
    let userEmail: string | null = null;
    let userPassword: string | null = null;

    // First check hardcoded credentials
    if (PIN_CREDENTIALS[pin]) {
      userEmail = PIN_CREDENTIALS[pin].email;
      userPassword = PIN_CREDENTIALS[pin].password;
    }

    // If not found in hardcoded, get email from DB
    if (!userEmail && dbUrl) {
      const parsedUrl = new URL(dbUrl);
      const dbClient = new Client({
        hostname: parsedUrl.hostname,
        port: parseInt(parsedUrl.port) || 5432,
        database: parsedUrl.pathname.slice(1),
        user: parsedUrl.username,
        password: decodeURIComponent(parsedUrl.password),
        tls: { enabled: true, enforce: false },
      });
      await dbClient.connect();
      const result = await dbClient.queryObject<{ email: string }>(
        `SELECT email FROM auth.users WHERE id = $1 AND deleted_at IS NULL`,
        [profile.id]
      );
      await dbClient.end();
      if (result.rows[0]) {
        userEmail = result.rows[0].email;
      }
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "לא נמצא אימייל למשתמש" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Sign in with password using anon client
    const anonKey = externalAnonKey || externalServiceKey;
    const supabaseAnon = createClient(externalUrl, anonKey);

    // For known users, sign in with password
    if (userPassword) {
      const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      });

      if (signInError || !signInData?.session) {
        // Fallback: try magic link approach via admin
        return new Response(
          JSON.stringify({ error: "שגיאה בכניסה: " + (signInError?.message || "no session") }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          session: signInData.session,
          profile: { id: profile.id, name: profile.name, role: profile.role },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For dynamically created employees, use magic link approach
    // Try the admin generateLink + verifyOtp approach
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });

    if (linkError || !linkData) {
      return new Response(
        JSON.stringify({ error: "שגיאה ביצירת קישור: " + (linkError?.message || "unknown") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const linkUrl = new URL(linkData.properties.action_link);
    const token_hash = linkUrl.searchParams.get("token");
    const type = linkUrl.searchParams.get("type");

    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: token_hash!,
      type: type as "magiclink",
    });

    if (verifyError || !sessionData?.session) {
      return new Response(
        JSON.stringify({ error: "שגיאה ביצירת סשן: " + (verifyError?.message || "no session") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        session: sessionData.session,
        profile: { id: profile.id, name: profile.name, role: profile.role },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "שגיאה פנימית: " + String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
