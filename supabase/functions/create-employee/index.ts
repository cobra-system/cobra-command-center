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
    // Verify the caller is a manager
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "לא מורשה" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is manager
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "לא מורשה" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (!callerProfile || callerProfile.role !== "MANAGER") {
      return new Response(
        JSON.stringify({ error: "רק מנהל יכול ליצור עובדים" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { name, role, pin } = await req.json();

    if (!name || !role || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "שם, תפקיד וקוד PIN (4 ספרות) נדרשים" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check PIN uniqueness using the secure verify function
    const { data: existingMatch } = await supabaseAdmin.rpc("login_by_pin", {
      input_pin: pin,
    });
    if (existingMatch && existingMatch.length > 0) {
      return new Response(
        JSON.stringify({ error: "קוד PIN כבר בשימוש" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user with a random non-guessable email and password
    const randomId = crypto.randomUUID();
    const email = `${randomId}@employee.internal`;
    const password = crypto.randomUUID();

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });

    if (createError || !newUser?.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || "שגיאה ביצירת משתמש" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the PIN and store it
    const { data: hashedPin } = await supabaseAdmin.rpc("hash_pin" as any, { raw_pin: pin });

    // Update the profile with hashed PIN
    await supabaseAdmin
      .from("profiles")
      .update({ pin: hashedPin, role })
      .eq("id", newUser.user.id);

    // Add user_role
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role });

    return new Response(
      JSON.stringify({ success: true, profile: { id: newUser.user.id, name, role } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
