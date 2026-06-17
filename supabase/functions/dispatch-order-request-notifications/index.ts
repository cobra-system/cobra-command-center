// Dispatch pending notifications from notification_queue:
//   • Email via Resend (HTML, RTL Hebrew) — sent to every recipient's auth email
//   • Web Push via VAPID — sent to devices registered in notification_subscriptions
//
// Email recipients are resolved from auth.users directly (via get_user_emails RPC)
// so division managers receive emails without needing to register a subscription.
//
// Configuration is loaded from the public.app_config table with env fallback,
// so it can be set without redeploying the function. Required keys:
//   • resend_api_key       (or env: RESEND_API_KEY)
//   • resend_from_email    (or env: RESEND_FROM_EMAIL)
//   • vapid_public_key     (or env: VAPID_PUBLIC_KEY)
//   • vapid_private_key    (or env: VAPID_PRIVATE_KEY)
//   • vapid_subject        (or env: VAPID_SUBJECT, e.g. mailto:noam@cobra.co.il)
//
// Triggered manually OR by the dispatch_notification_queue_trg pg_net trigger
// when a new row hits notification_queue. Body is ignored — we always pull the
// next batch of pending rows.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const BATCH_SIZE = 50;
const GEORGE_EMAIL = "george@cobra.co.il";

interface QueueRow {
  id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  recipient_division: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

interface PushSubRow {
  id: string;
  user_id: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

interface SupabaseClientLike {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle?: () => Promise<{ data: { value: string } | null }>;
      };
    };
  };
}

const EVENT_LABELS: Record<string, string> = {
  order_request_created:  "בקשת הזמנה חדשה",
  order_request_urgent:   "בקשת הזמנה דחופה",
  order_request_received: "הבקשה שלך התקבלה",
  order_request_fulfilled:"הבקשה שלך הוזמנה",
  order_request_rejected: "הבקשה שלך נדחתה",
  order_request_commented:"תגובה חדשה בבקשה",
};

async function loadConfig(supabase: SupabaseClientLike, key: string, envName: string): Promise<string> {
  const env = Deno.env.get(envName);
  if (env) return env;
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { value: string } | null }>;
        };
      };
    };
  };
  const { data } = await sb.from("app_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? "";
}

async function sendResendEmail(apiKey: string, from: string, to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend ${res.status}: ${txt}`);
  }
}

function buildEmailHtml(eventType: string, payload: Record<string, unknown>): { subject: string; html: string } {
  const productName = String(payload.product_name ?? "—");
  const division    = String(payload.division    ?? "—");
  const urgency     = payload.urgency  ? String(payload.urgency)  : null;
  const supplier    = payload.supplier ? String(payload.supplier) : null;
  const quantity    = payload.quantity != null ? String(payload.quantity) : null;
  const orderType   = payload.order_type ? String(payload.order_type) : null;
  const sku         = payload.product_sku ? String(payload.product_sku) : null;

  const urgencyColor = urgency === "דחוף" ? "#ef4444" : urgency === "נמוך" ? "#6b7280" : "#f97316";

  const subject = `${EVENT_LABELS[eventType] ?? eventType}: ${productName}`;

  const introText = (() => {
    switch (eventType) {
      case "order_request_created":
        return `מנהל החטיבה <strong>${payload.created_by_name ?? ""}</strong> פתח בקשת הזמנה חדשה ב-<strong>${division}</strong>.`;
      case "order_request_urgent":
        return `⚠️ בקשה <strong>דחופה</strong> ב-<strong>${division}</strong> ממתינה לטיפולך.`;
      case "order_request_received":
        return `הבקשה שלך ל-<strong>${productName}</strong> התקבלה ונשלחה למנהל הרכש לאישור.`;
      case "order_request_fulfilled":
        return `מנהל הרכש <strong>${payload.ordered_by_name ?? ""}</strong> ביצע את הבקשה שלך להזמנת <strong>${productName}</strong>.`;
      case "order_request_rejected":
        return `הבקשה שלך ל-<strong>${productName}</strong> נדחתה.${payload.reject_reason ? `<br><span style="color:#ef4444">סיבה: ${payload.reject_reason}</span>` : ""}`;
      case "order_request_commented":
        return `<strong>${payload.comment_author ?? "—"}</strong> פרסם תגובה בבקשה מחטיבת <strong>${division}</strong>.`;
      default:
        return "";
    }
  })();

  const badgeStyle = (color: string, bg: string) =>
    `display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;color:${color};background:${bg}`;

  const statusBadge = (() => {
    switch (eventType) {
      case "order_request_urgent":
        return `<span style="${badgeStyle("#fff","#ef4444")}">דחוף</span>`;
      case "order_request_received":
        return `<span style="${badgeStyle("#fff","#6366f1")}">ממתין לאישור</span>`;
      case "order_request_fulfilled":
        return `<span style="${badgeStyle("#fff","#22c55e")}">הוזמן ✓</span>`;
      case "order_request_rejected":
        return `<span style="${badgeStyle("#fff","#ef4444")}">נדחה</span>`;
      default:
        return "";
    }
  })();

  const detailRows = [
    ["מוצר",      productName],
    sku       ? ["מק\"ט",   sku]       : null,
    ["חטיבה",     division],
    supplier  ? ["ספק",     supplier]  : null,
    quantity  ? ["כמות",    quantity]  : null,
    orderType ? ["סוג הזמנה", orderType] : null,
    urgency   ? ["דחיפות",  `<span style="font-weight:600;color:${urgencyColor}">${urgency}</span>`] : null,
  ]
    .filter(Boolean)
    .map(([label, val]) => `
      <tr>
        <td style="padding:7px 10px;color:#6b7280;font-size:13px;white-space:nowrap">${label}</td>
        <td style="padding:7px 10px;font-size:13px;font-weight:500">${val}</td>
      </tr>`)
    .join("");

  const commentBlock = payload.comment_body
    ? `<blockquote style="margin:16px 0 0;padding:12px 16px;border-right:4px solid #6366f1;background:#eef2ff;color:#3730a3;border-radius:4px;font-size:13px">${payload.comment_body}</blockquote>`
    : "";

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;direction:rtl">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#1e3a5f;padding:18px 24px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="color:#ffffff;font-size:16px;font-weight:700">🐍 Cobra Command Center</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:2px">${EVENT_LABELS[eventType] ?? eventType}</div>
      </div>
      ${statusBadge}
    </div>

    <!-- Body -->
    <div style="padding:20px 24px">
      <p style="color:#1f2937;font-size:15px;margin:0 0 16px;line-height:1.6">${introText}</p>

      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
        ${detailRows}
      </table>

      ${commentBlock}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:11px;margin:0">הודעה אוטומטית · Cobra Command Center</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

interface WebPushModule {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (sub: unknown, payload: string) => Promise<{ statusCode?: number; body?: string }>;
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapid: { publicKey: string; privateKey: string; subject: string },
): Promise<{ ok: boolean; status: number; body?: string }> {
  const mod = await import("https://esm.sh/web-push@3.6.7?target=denonext") as { default?: WebPushModule } & WebPushModule;
  const webpush: WebPushModule = mod.default ?? mod;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  try {
    const res = await webpush.sendNotification(subscription, payload);
    return { ok: true, status: res.statusCode ?? 200, body: res.body };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    return { ok: false, status: e.statusCode ?? 500, body: e.body ?? e.message };
  }
}

interface RpcSupabase {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

// Look up auth emails for a list of profile IDs via the get_user_emails DB function.
// Falls back to empty list on error so a missing RPC never blocks delivery.
async function resolveEmails(supabase: RpcSupabase, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.rpc("get_user_emails", { user_ids: userIds });
  if (error || !data) return [];
  return (data as { id: string; email: string }[])
    .map((r) => r.email)
    .filter(Boolean);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [resendKey, resendFrom, vapidPublic, vapidPrivate, vapidSubject] = await Promise.all([
    loadConfig(supabase, "resend_api_key",    "RESEND_API_KEY"),
    loadConfig(supabase, "resend_from_email", "RESEND_FROM_EMAIL"),
    loadConfig(supabase, "vapid_public_key",  "VAPID_PUBLIC_KEY"),
    loadConfig(supabase, "vapid_private_key", "VAPID_PRIVATE_KEY"),
    loadConfig(supabase, "vapid_subject",     "VAPID_SUBJECT"),
  ]);

  const fromAddr    = resendFrom || "notifications@cobra-system.com";
  const emailEnabled = !!resendKey;
  const pushEnabled  = !!(vapidPublic && vapidPrivate && vapidSubject);

  const { data: queue, error: qerr } = await supabase
    .from("notification_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (qerr) {
    return new Response(JSON.stringify({ error: qerr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0;

  for (const row of (queue ?? []) as QueueRow[]) {
    try {
      // ── Resolve recipient profile IDs ───────────────────────────────────────
      let recipientIds: string[] = [];
      if (row.recipient_user_id) {
        recipientIds = [row.recipient_user_id];
      } else if (row.recipient_role === "MANAGER") {
        const { data } = await supabase.from("profiles").select("id").eq("role", "MANAGER");
        recipientIds = (data ?? []).map((r: { id: string }) => r.id);
      } else if (row.recipient_role === "DIVISION_MANAGER" && row.recipient_division) {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("division", row.recipient_division)
          .neq("role", "MANAGER");
        recipientIds = (data ?? []).map((r: { id: string }) => r.id);
      }

      const { subject, html } = buildEmailHtml(row.event_type, row.payload);
      const pushPayload = JSON.stringify({
        title: subject,
        body:  row.payload.product_name ?? "",
        data:  { request_id: row.payload.request_id ?? null, url: "/orders" },
      });

      const errors: string[] = [];
      let anyDelivered = false;

      // ── Email: send to each recipient's auth.users email ───────────────────
      if (emailEnabled && recipientIds.length > 0) {
        const emails = await resolveEmails(supabase, recipientIds);
        for (const email of emails) {
          try {
            await sendResendEmail(resendKey, fromAddr, email, subject, html);
            anyDelivered = true;
          } catch (err) {
            errors.push(`email(${email}): ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // ── Push: still use notification_subscriptions ──────────────────────────
      if (pushEnabled && recipientIds.length > 0) {
        const { data: subs } = await supabase
          .from("notification_subscriptions")
          .select("id,user_id,config,is_active")
          .in("user_id", recipientIds)
          .eq("channel", "push")
          .eq("is_active", true);

        for (const sub of (subs ?? []) as PushSubRow[]) {
          try {
            const cfg = sub.config as { endpoint: string; keys: { p256dh: string; auth: string } };
            const result = await sendWebPush(cfg, pushPayload, {
              publicKey: vapidPublic, privateKey: vapidPrivate, subject: vapidSubject,
            });
            if (result.ok) {
              anyDelivered = true;
              await supabase.from("notification_subscriptions")
                .update({ last_used_at: new Date().toISOString() })
                .eq("id", sub.id);
            } else {
              errors.push(`push ${result.status}: ${result.body ?? "unknown"}`);
              if (result.status === 404 || result.status === 410) {
                await supabase.from("notification_subscriptions")
                  .update({ is_active: false }).eq("id", sub.id);
              }
            }
          } catch (err) {
            errors.push(err instanceof Error ? err.message : String(err));
          }
        }
      }

      // ── Always forward every order-request event to george@cobra.co.il ─────
      if (emailEnabled) {
        try {
          await sendResendEmail(resendKey, fromAddr, GEORGE_EMAIL, subject, html);
          anyDelivered = true;
        } catch (err) {
          errors.push(`george: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (anyDelivered) {
        await supabase.from("notification_queue").update({
          status:     "sent",
          attempts:   row.attempts + 1,
          sent_at:    new Date().toISOString(),
          last_error: errors.length > 0 ? `partial: ${errors.join("; ")}` : null,
        }).eq("id", row.id);
        sent++;
      } else {
        await supabase.from("notification_queue").update({
          status:     row.attempts >= 3 ? "failed" : "pending",
          attempts:   row.attempts + 1,
          last_error: errors.join("; ") || "no successful delivery",
        }).eq("id", row.id);
        failed++;
      }
    } catch (err) {
      await supabase.from("notification_queue").update({
        status:     row.attempts >= 3 ? "failed" : "pending",
        attempts:   row.attempts + 1,
        last_error: err instanceof Error ? err.message : String(err),
      }).eq("id", row.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({
    processed: queue?.length ?? 0, sent, failed,
    config: { emailEnabled, pushEnabled },
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
