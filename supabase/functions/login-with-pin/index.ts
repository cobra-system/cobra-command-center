import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();

    if (!pin || typeof pin !== "string" || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "PIN חייב להיות 4 ספרות" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limiting: check recent failed attempts from this IP
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";
    
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    
    const { count: recentFailures } = await supabaseAdmin
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", clientIP)
      .eq("success", false)
      .gte("attempted_at", windowStart);

    if ((recentFailures || 0) >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ error: "יותר מדי ניסיונות כניסה. נסה שוב מאוחר יותר." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up user by PIN using the secure DB function (bcrypt comparison)
    const { data: profiles, error: rpcError } = await supabaseAdmin.rpc("login_by_pin", {
      input_pin: pin,
    });

    const profile = profiles?.[0];

    if (rpcError || !profile) {
      // Log failed attempt
      await supabaseAdmin.from("login_attempts").insert({
        ip_address: clientIP,
        success: false,
      });
      
      return new Response(
        JSON.stringify({ error: "קוד PIN שגוי" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful attempt
    await supabaseAdmin.from("login_attempts").insert({
      ip_address: clientIP,
      success: true,
    });

    // Get the user's email from auth.users to sign them in
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (authError || !authUser?.user?.email) {
      return new Response(
        JSON.stringify({ error: "שגיאה באימות המשתמש" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link token for the user (sign them in without password)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
    });

    if (linkError || !linkData) {
      return new Response(
        JSON.stringify({ error: "שגיאה ביצירת קישור כניסה" }),
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
        JSON.stringify({ error: "שגיאה ביצירת סשן" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      JSON.stringify({ error: "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
