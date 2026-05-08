/**
 * review-signup-request — manager-only endpoint that approves or rejects a
 * pending signup_request. On approval, creates the auth user + profile +
 * user_roles row, and emails the user with their credentials. On rejection,
 * marks the request rejected and emails the user.
 *
 * Body:
 *   { action: "approve", request_id, role, password, name?, role_definition_id?, allowed_product_ids?, division? }
 *   { action: "reject",  request_id, reason? }
 */
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { checkRateLimit, getClientId } from "../_shared/rate-limit.ts";
import { validatePassword } from "../_shared/password.ts";
import { logAudit, getClientIp } from "../_shared/audit.ts";
import { sendEmail } from "../_shared/email.ts";
import { buildApprovalEmail, buildRejectionEmail } from "../_shared/signupEmail.ts";

const VALID_ROLES = ["MANAGER", "WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER"] as const;
type ValidRole = typeof VALID_ROLES[number];

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const clientId = getClientId(req);
    const { limited } = checkRateLimit(`review-signup:${clientId}`, 30, 60_000);
    if (limited) return json({ error: "יותר מדי בקשות, נסה שוב מאוחר יותר" }, 429);

    const authResult = await verifyAuth(req, ["MANAGER"]);
    if ("error" in authResult) {
      return json({ error: authResult.error }, authResult.status);
    }
    const admin = authResult.auth.supabaseAdmin;

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;
    const requestId = body.request_id as string | undefined;
    if (!requestId) return json({ error: "חסר מזהה בקשה" }, 400);

    const { data: request, error: reqErr } = await admin
      .from("signup_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (reqErr || !request) return json({ error: "בקשה לא נמצאה" }, 404);
    if (request.status !== "pending") return json({ error: "הבקשה כבר טופלה" }, 409);

    const appUrl = req.headers.get("origin") || Deno.env.get("APP_URL") || null;

    if (action === "approve") {
      const role = body.role as string;
      const password = body.password as string | undefined;
      const name = (body.name as string | undefined)?.trim() || request.name;
      const roleDefinitionId = body.role_definition_id as string | undefined;
      const allowedProductIds = body.allowed_product_ids as string[] | undefined;
      const division = body.division as string | undefined;

      if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
        return json({ error: "תפקיד לא חוקי" }, 400);
      }
      if (!password) return json({ error: "יש לקבוע סיסמה ראשונית" }, 400);
      const pwCheck = validatePassword(password);
      if (!pwCheck.valid) return json({ error: pwCheck.error }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: request.email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      });
      if (createErr || !created?.user) {
        return json({ error: createErr?.message || "שגיאה ביצירת משתמש" }, 500);
      }

      const profileData: Record<string, unknown> = {
        id: created.user.id,
        name,
        role: role as ValidRole,
      };
      if (roleDefinitionId) profileData.role_definition_id = roleDefinitionId;
      if (Array.isArray(allowedProductIds)) profileData.allowed_product_ids = allowedProductIds;
      if (division) profileData.division = division;

      const { error: profileErr } = await admin.from("profiles").upsert(profileData, { onConflict: "id" });
      if (profileErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: `שגיאה ביצירת פרופיל: ${profileErr.message}` }, 500);
      }

      const { error: roleErr } = await admin
        .from("user_roles")
        .upsert({ user_id: created.user.id, role }, { onConflict: "user_id,role" });
      if (roleErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: `שגיאה בשיוך הרשאות: ${roleErr.message}` }, 500);
      }

      await admin
        .from("signup_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: authResult.auth.user.id,
          approved_user_id: created.user.id,
        })
        .eq("id", requestId);

      await logAudit(admin, {
        user_id: authResult.auth.user.id,
        action: "signup.approve",
        entity_type: "signup_request",
        entity_id: requestId,
        details: { email: request.email, role },
        ip_address: getClientIp(req),
      });

      try {
        const { subject, html } = buildApprovalEmail({
          name,
          email: request.email,
          password,
          appUrl,
        });
        await sendEmail({ to: request.email, subject, html });
      } catch (e) {
        console.error("[review-signup-request] approval email failed", e);
      }

      return json({ success: true, user_id: created.user.id }, 200);
    }

    if (action === "reject") {
      const reason = body.reason ? String(body.reason).slice(0, 1000) : null;
      await admin
        .from("signup_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: authResult.auth.user.id,
          reject_reason: reason,
        })
        .eq("id", requestId);

      await logAudit(admin, {
        user_id: authResult.auth.user.id,
        action: "signup.reject",
        entity_type: "signup_request",
        entity_id: requestId,
        details: { email: request.email, reason },
        ip_address: getClientIp(req),
      });

      try {
        const { subject, html } = buildRejectionEmail({
          name: request.name,
          email: request.email,
          rejectReason: reason,
          appUrl,
        });
        await sendEmail({ to: request.email, subject, html });
      } catch (e) {
        console.error("[review-signup-request] rejection email failed", e);
      }

      return json({ success: true }, 200);
    }

    return json({ error: "פעולה לא חוקית" }, 400);
  } catch (err) {
    console.error("[review-signup-request] error", err);
    return json({ error: "שגיאה פנימית" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
