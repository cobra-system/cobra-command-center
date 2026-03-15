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
    const { pin } = await req.json();

    if (!pin || typeof pin !== "string" || pin.length !== 4) {
      return new Response(
        JSON.stringify({ error: "PIN חייב להיות 4 ספרות" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connect to the EXTERNAL Supabase project where all data lives
    const externalUrl = Deno.env.get("SUPABASE_URL")!;
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(externalUrl, externalServiceKey);

    // First try plaintext PIN match
    let profile: any = null;
    const { data: plainMatch } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role, pin")
      .eq("pin", pin)
      .maybeSingle();

    if (plainMatch) {
      profile = plainMatch;
    } else {
      // Try using the login_by_pin RPC (handles bcrypt hashed PINs)
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

    // Get the user's email from auth.users to sign them in
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (authError || !authUser?.user?.email) {
      return new Response(
        JSON.stringify({ error: "שגיאה באימות המשתמש - לא נמצא משתמש auth" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link token for the user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
    });

    if (linkError || !linkData) {
      return new Response(
        JSON.stringify({ error: "שגיאה ביצירת קישור כניסה: " + (linkError?.message || "unknown") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the token from the link and verify it to get a session
    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get("token");
    const type = url.searchParams.get("type");

    // Verify the OTP to get session tokens
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

    // Also update plaintext PIN if it was matched via RPC (bcrypt) but not stored as plaintext
    if (!plainMatch && profile) {
      await supabaseAdmin.from("profiles").update({ pin }).eq("id", profile.id);
    }

    return new Response(
      JSON.stringify({
        session: sessionData.session,
        profile: {
          id: profile.id,
          name: profile.name,
          role: profile.role,
        },
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
