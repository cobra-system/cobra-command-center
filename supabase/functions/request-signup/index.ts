/**
 * request-signup — public endpoint that creates a pending signup_request and
 * notifies the system administrators. The request must be approved through the
 * review-signup-request function before the user can log in.
 *
 * Body: { email, name, password?, message?, requestedRole?, provider? }
 *
 * No JWT required; rate-limited per IP.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit, getClientId } from "../_shared/rate-limit.ts";
import { sendEmail } from "../_shared/email.ts";
import { buildAdminApprovalEmail, getAdminRecipients } from "../_shared/signupEmail.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const clientId = getClientId(req);
    const { limited, retryAfterMs } = checkRateLimit(`request-signup:${clientId}`, 5, 60_000);
    if (limited) {
      return json({ error: "יותר מדי בקשות, נסה שוב מאוחר יותר" }, 429, {
        "Retry-After": String(Math.ceil((retryAfterMs || 60_000) / 1000)),
      });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const message = body.message ? String(body.message).trim().slice(0, 1000) : null;
    const requestedRole = body.requestedRole ? String(body.requestedRole).trim().slice(0, 120) : null;
    const provider = body.provider === "google" ? "google" : "email";

    if (!email || !EMAIL_RE.test(email)) return json({ error: "אימייל לא תקין" }, 400);
    if (!name || name.length < 2) return json({ error: "יש להזין שם מלא" }, 400);

    const admin = getSupabaseAdmin();

    // Reject if a profile already exists for this email (already a user).
    const { data: existingUserList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const exists = existingUserList?.users?.some(u => (u.email || "").toLowerCase() === email);
    if (exists) {
      return json({ error: "כבר קיים חשבון עם האימייל הזה. נסה להתחבר או לאפס סיסמה." }, 409);
    }

    // Reject if there's already a pending request for this email.
    const { data: existingPending } = await admin
      .from("signup_requests")
      .select("id")
      .eq("status", "pending")
      .ilike("email", email)
      .maybeSingle();
    if (existingPending) {
      return json({ error: "כבר נשלחה בקשת הרשמה לאימייל זה. אנא המתן לאישור." }, 409);
    }

    const { data: inserted, error: insertErr } = await admin
      .from("signup_requests")
      .insert({ email, name, message, requested_role: requestedRole, provider })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      return json({ error: insertErr?.message || "שגיאה בשמירת הבקשה" }, 500);
    }

    // Send notification email to administrators (best-effort).
    try {
      const appUrl = req.headers.get("origin") || Deno.env.get("APP_URL") || null;
      const { subject, html } = buildAdminApprovalEmail({ email, name, message, requestedRole, provider, appUrl });
      await sendEmail({ to: getAdminRecipients(), subject, html });
    } catch (emailErr) {
      console.error("[request-signup] email send failed", emailErr);
    }

    return json({ success: true, id: inserted.id }, 200);
  } catch (err) {
    console.error("[request-signup] error", err);
    return json({ error: "שגיאה פנימית" }, 500);
  }
});

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}
