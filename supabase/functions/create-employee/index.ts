import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { checkRateLimit, getClientId } from "../_shared/rate-limit.ts";
import { validatePassword } from "../_shared/password.ts";
import { logAudit, getClientIp } from "../_shared/audit.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit: 5 employee creations per minute per IP
    const clientId = getClientId(req);
    const { limited, retryAfterMs } = checkRateLimit(`create-employee:${clientId}`, 5, 60_000);
    if (limited) {
      return new Response(
        JSON.stringify({ error: "יותר מדי בקשות, נסה שוב מאוחר יותר" }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((retryAfterMs || 60_000) / 1000)),
          },
        }
      );
    }

    // Verify caller is a MANAGER
    const authResult = await verifyAuth(req, ["MANAGER"]);
    if ("error" in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { name, role, email, password, role_definition_id, allowed_product_ids, division } = await req.json();
    const validRoles = ["MANAGER", "WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER"] as const;

    if (!name || !role || !email) {
      return new Response(
        JSON.stringify({ error: "שם, תפקיד ואימייל נדרשים" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return new Response(
        JSON.stringify({ error: pwCheck.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "תפקיד לא חוקי לעובד" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = authResult.auth.supabaseAdmin;

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

    const profileData: Record<string, unknown> = { id: newUser.user.id, name, role };
    if (role_definition_id) profileData.role_definition_id = role_definition_id;
    if (Array.isArray(allowed_product_ids)) profileData.allowed_product_ids = allowed_product_ids;
    if (division) profileData.division = division;
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

    await logAudit(supabaseAdmin, {
      user_id: authResult.auth.user.id,
      action: "employee.create",
      entity_type: "employee",
      entity_id: newUser.user.id,
      details: { name, role, email },
      ip_address: getClientIp(req),
    });

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
