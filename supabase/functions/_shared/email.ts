export interface EmailAttachment {
  /** File name as it should appear in the recipient's mail client. */
  filename: string;
  /** Base64-encoded file content (no data: prefix). */
  content: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string[];
  attachments?: EmailAttachment[];
  /** Overrides the RESEND_API_KEY env var — use with loadEmailConfig(). */
  apiKey?: string;
}

/**
 * Resolves the Resend credentials, preferring the env vars and falling back to
 * the app_config table so they can be rotated without redeploying a function.
 */
export async function loadEmailConfig(supabaseAdmin: unknown): Promise<{ apiKey: string; from: string }> {
  const envKey = Deno.env.get("RESEND_API_KEY");
  const envFrom = Deno.env.get("RESEND_FROM_EMAIL");
  if (envKey && envFrom) return { apiKey: envKey, from: envFrom };

  // Structurally typed rather than importing the client's generics — this
  // module is shared by functions that build their client differently.
  const client = supabaseAdmin as {
    from: (table: string) => {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => Promise<{ data: { key: string; value: string }[] | null }>;
      };
    };
  };

  const { data } = await client
    .from("app_config")
    .select("key, value")
    .in("key", ["resend_api_key", "resend_from_email"]);
  const config = Object.fromEntries((data ?? []).map(r => [r.key, r.value]));

  return {
    apiKey: envKey || config.resend_api_key || "",
    from: envFrom || config.resend_from_email || "notifications@cobra-system.com",
  };
}

/** Sends one mail through Resend. Returns the provider message id when given. */
export async function sendEmail(opts: SendEmailOptions): Promise<string | null> {
  const apiKey = opts.apiKey || Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY לא מוגדר");

  const from = opts.from ?? Deno.env.get("RESEND_FROM_EMAIL") ?? "notifications@cobra-system.com";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.cc && opts.cc.length > 0 ? { cc: opts.cc } : {}),
      ...(opts.attachments && opts.attachments.length > 0 ? { attachments: opts.attachments } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API שגיאה ${res.status}: ${errText}`);
  }

  const body = await res.json().catch(() => null) as { id?: string } | null;
  return body?.id ?? null;
}

export function buildDailyDigestHtml(opts: {
  overdueOrders: { id: string; items: string; supplier: string; etaDaysAgo: number }[];
  upcomingPayments: { orderId: string; supplier: string; amount: number; currency: string; daysLeft: number }[];
  date: string;
}): string {
  const { overdueOrders, upcomingPayments, date } = opts;

  const overdueSection = overdueOrders.length === 0
    ? `<p style="color:#6b7280">אין הזמנות באיחור 🎉</p>`
    : overdueOrders.map(o => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${o.items}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${o.supplier}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#ef4444;font-weight:600">${o.etaDaysAgo} ימים</td>
        </tr>`).join("");

  const paymentsSection = upcomingPayments.length === 0
    ? `<p style="color:#6b7280">אין תשלומים קרובים</p>`
    : upcomingPayments.map(p => {
        const symbol = p.currency === "USD" ? "$" : p.currency === "EUR" ? "€" : "₪";
        const urgentColor = p.daysLeft <= 1 ? "#ef4444" : p.daysLeft <= 3 ? "#f97316" : "#374151";
        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${p.supplier}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">${symbol}${p.amount.toLocaleString()} ${p.currency}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:${urgentColor};font-weight:600">${p.daysLeft === 0 ? "היום!" : `${p.daysLeft} ימים`}</td>
          </tr>`;
      }).join("");

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;direction:rtl">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#1e3a5f;padding:20px 24px">
      <h1 style="color:#ffffff;margin:0;font-size:20px">🐍 Cobra Command Center</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:14px">דוח יומי — ${date}</p>
    </div>

    <div style="padding:24px">
      <h2 style="font-size:16px;margin-bottom:12px;color:#111827">
        🚨 הזמנות באיחור (${overdueOrders.length})
      </h2>
      ${overdueOrders.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px;text-align:right">פריטים</th>
            <th style="padding:8px;text-align:right">ספק</th>
            <th style="padding:8px;text-align:right">איחור</th>
          </tr>
        </thead>
        <tbody>${overdueSection}</tbody>
      </table>` : overdueSection}

      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">

      <h2 style="font-size:16px;margin-bottom:12px;color:#111827">
        💳 תשלומים קרובים (${upcomingPayments.length})
      </h2>
      ${upcomingPayments.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px;text-align:right">ספק</th>
            <th style="padding:8px;text-align:right">סכום</th>
            <th style="padding:8px;text-align:right">מועד</th>
          </tr>
        </thead>
        <tbody>${paymentsSection}</tbody>
      </table>` : paymentsSection}
    </div>

    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        הודעה אוטומטית מ-Cobra Command Center | לניהול הגדרות פנה למנהל המערכת
      </p>
    </div>
  </div>
</body>
</html>`;
}
