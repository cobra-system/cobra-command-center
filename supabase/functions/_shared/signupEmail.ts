/**
 * HTML templates for signup-approval emails.
 */

const ADMIN_RECIPIENTS = ["noamshemla@gmail.com", "noam@cobra.co.il"];

export function getAdminRecipients(): string[] {
  const fromEnv = Deno.env.get("SIGNUP_APPROVAL_RECIPIENTS");
  if (!fromEnv) return ADMIN_RECIPIENTS;
  return fromEnv.split(",").map(s => s.trim()).filter(Boolean);
}

interface AdminNotificationOpts {
  email: string;
  name: string;
  message?: string | null;
  requestedRole?: string | null;
  provider: string;
  appUrl?: string | null;
}

export function buildAdminApprovalEmail(opts: AdminNotificationOpts): { subject: string; html: string } {
  const { email, name, message, requestedRole, provider, appUrl } = opts;
  const settingsLink = appUrl ? `${appUrl.replace(/\/$/, "")}/settings?tab=signup-requests` : null;

  const subject = `בקשת הרשמה חדשה: ${name} (${email})`;
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;direction:rtl">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#1e3a5f;padding:20px 24px">
      <h1 style="color:#ffffff;margin:0;font-size:20px">🐍 Cobra Command Center</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:14px">בקשת הרשמה חדשה ממתינה לאישור</p>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#6b7280">שם</td><td style="padding:8px 0;font-weight:600">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">אימייל</td><td style="padding:8px 0;font-weight:600">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">אופן הרשמה</td><td style="padding:8px 0">${provider === "google" ? "Google" : "אימייל וסיסמה"}</td></tr>
        ${requestedRole ? `<tr><td style="padding:8px 0;color:#6b7280">תפקיד מבוקש</td><td style="padding:8px 0">${escapeHtml(requestedRole)}</td></tr>` : ""}
        ${message ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">הודעה</td><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(message)}</td></tr>` : ""}
      </table>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb">
      <p style="color:#374151;font-size:14px;margin:0 0 16px">
        כדי לאשר/לדחות את הבקשה ולקבוע תפקיד, היכנס למערכת ועבור לטאב "בקשות הרשמה" בהגדרות.
      </p>
      ${settingsLink ? `<p style="margin:0"><a href="${settingsLink}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">פתח בקשות הרשמה</a></p>` : ""}
    </div>
    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">הודעה אוטומטית מ-Cobra Command Center</p>
    </div>
  </div>
</body>
</html>`;
  return { subject, html };
}

interface UserDecisionOpts {
  name: string;
  email: string;
  password?: string | null;
  rejectReason?: string | null;
  appUrl?: string | null;
}

export function buildApprovalEmail(opts: UserDecisionOpts): { subject: string; html: string } {
  const { name, email, password, appUrl } = opts;
  const loginLink = appUrl ?? "";
  const subject = "החשבון שלך ב-Cobra Command Center אושר";
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;direction:rtl">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#1e3a5f;padding:20px 24px">
      <h1 style="color:#ffffff;margin:0;font-size:20px">🐍 Cobra Command Center</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:14px">החשבון שלך אושר</p>
    </div>
    <div style="padding:24px;color:#374151;font-size:14px;line-height:1.6">
      <p>שלום ${escapeHtml(name)},</p>
      <p>החשבון שלך ב-Cobra Command Center אושר ואתה יכול להיכנס למערכת.</p>
      ${password ? `
      <div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px;color:#6b7280;font-size:12px">פרטי כניסה</p>
        <p style="margin:0"><strong>אימייל:</strong> ${escapeHtml(email)}</p>
        <p style="margin:4px 0 0"><strong>סיסמה זמנית:</strong> <code style="background:#fff;padding:2px 6px;border-radius:4px">${escapeHtml(password)}</code></p>
        <p style="margin:8px 0 0;color:#ef4444;font-size:12px">מומלץ להחליף את הסיסמה לאחר הכניסה הראשונה.</p>
      </div>` : `
      <p>היכנס באמצעות אותו אימייל וסיסמה שבחרת בעת ההרשמה (או באמצעות Google אם זו הייתה השיטה שלך).</p>`}
      ${loginLink ? `<p><a href="${loginLink}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">כניסה למערכת</a></p>` : ""}
    </div>
    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">הודעה אוטומטית מ-Cobra Command Center</p>
    </div>
  </div>
</body>
</html>`;
  return { subject, html };
}

export function buildRejectionEmail(opts: UserDecisionOpts): { subject: string; html: string } {
  const { name, rejectReason } = opts;
  const subject = "בקשת ההרשמה ל-Cobra Command Center";
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;direction:rtl">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#1e3a5f;padding:20px 24px">
      <h1 style="color:#ffffff;margin:0;font-size:20px">🐍 Cobra Command Center</h1>
    </div>
    <div style="padding:24px;color:#374151;font-size:14px;line-height:1.6">
      <p>שלום ${escapeHtml(name)},</p>
      <p>בקשת ההרשמה שלך ל-Cobra Command Center לא אושרה.</p>
      ${rejectReason ? `<p><strong>הסבר:</strong><br>${escapeHtml(rejectReason)}</p>` : ""}
      <p>אם אתה חושב שזו טעות, פנה למנהל המערכת.</p>
    </div>
  </div>
</body>
</html>`;
  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
