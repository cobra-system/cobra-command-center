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

    // Connect to external backend where auth + data are stored
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(externalUrl, externalServiceKey);

    // Verify caller token against the external auth project
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
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

    const { name, role, email, password, pin, role_definition_id } = await req.json();
    const validRoles = ["MANAGER", "WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER"] as const;

    if (!name || !role) {
      return new Response(
        JSON.stringify({ error: "שם ותפקיד נדרשים" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Must provide either email+password or a PIN
    const hasCreds = email && password && password.length >= 6;
    const hasPin = pin && String(pin).length === 4;
    if (!hasCreds && !hasPin) {
      return new Response(
        JSON.stringify({ error: "נדרש אימייל וסיסמה (לפחות 6 תווים) או קוד PIN בן 4 ספרות" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "תפקיד לא חוקי לעובד" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For PIN-only employees, generate a synthetic email + random password
    const authEmail = email || `pin-${crypto.randomUUID()}@pin.internal`;
    const authPassword = (hasCreds ? password : crypto.randomUUID() + crypto.randomUUID());

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: authPassword,
      email_confirm: true,
      user_metadata: { name, role },
    });

    if (createError || !newUser?.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || "שגיאה ביצירת משתמש" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure profile exists גם אם ה-trigger לא יצר אותו
    const profileData: Record<string, unknown> = { id: newUser.user.id, name, role };
    if (role_definition_id) profileData.role_definition_id = role_definition_id;
    if (pin) profileData.pin = String(pin);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: `שגיאה ביצירת פרופיל עובד: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: newUser.user.id, role }, { onConflict: "user_id,role" });

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: `שגיאה בשיוך הרשאות לעובד: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
