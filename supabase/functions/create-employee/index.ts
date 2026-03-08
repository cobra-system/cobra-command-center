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

    if (!name || !role || !pin || pin.length !== 4) {
      return new Response(
        JSON.stringify({ error: "שם, תפקיד וקוד PIN (4 ספרות) נדרשים" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check PIN uniqueness
    const { data: existingPin } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("pin", pin)
      .maybeSingle();
    if (existingPin) {
      return new Response(
        JSON.stringify({ error: "קוד PIN כבר בשימוש" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user with a generated email
    const email = `${pin}@employee.cobra.io`;
    const password = `pin-${pin}-${Date.now()}`;

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

    // Update the profile with PIN (handle_new_user trigger creates the profile)
    await supabaseAdmin
      .from("profiles")
      .update({ pin, role })
      .eq("id", newUser.user.id);

    // Add user_role
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role });

    return new Response(
      JSON.stringify({ success: true, profile: { id: newUser.user.id, name, role, pin } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
