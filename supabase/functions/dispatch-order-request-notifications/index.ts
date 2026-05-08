// Dispatch pending notifications from notification_queue:
//   • Email via Resend (using existing _shared/email.ts helper)
//   • Web Push via VAPID
// Triggered manually (cron) or after webhook events. Picks the next ~50 pending rows.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";

const BATCH_SIZE = 50;

interface QueueRow {
  id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  recipient_division: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

interface SubRow {
  id: string;
  user_id: string;
  channel: "email" | "push";
  config: Record<string, unknown>;
  is_active: boolean;
}

interface ProfileRow {
  id: string;
  name: string | null;
  role: string | null;
  division: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  order_request_created: "בקשת הזמנה חדשה",
  order_request_urgent: "בקשת הזמנה דחופה",
  order_request_fulfilled: "הבקשה שלך הוזמנה",
  order_request_rejected: "הבקשה שלך נדחתה",
  order_request_commented: "תגובה חדשה בבקשה",
};

function buildEmailHtml(eventType: string, payload: Record<string, unknown>): { subject: string; html: string } {
  const productName = String(payload.product_name ?? "—");
  const division = String(payload.division ?? "—");
  const subject = `${EVENT_LABELS[eventType] ?? eventType}: ${productName}`;
  const intro = (() => {
    switch (eventType) {
      case "order_request_created":
        return `מנהל החטיבה ${payload.created_by_name ?? ""} פתח בקשת הזמנה חדשה ב-${division}.`;
      case "order_request_urgent":
        return `בקשה דחופה ב-${division} ממתינה לטיפולך.`;
      case "order_request_fulfilled":
        return `מנהל הרכש (${payload.ordered_by_name ?? ""}) ביצע את הבקשה שלך.`;
      case "order_request_rejected":
        return `הבקשה שלך נדחתה.${payload.reject_reason ? ` סיבה: ${payload.reject_reason}` : ""}`;
      case "order_request_commented":
        return `${payload.comment_author ?? "—"} פרסם תגובה בבקשה ב-${division}.`;
      default:
        return "";
    }
  })();

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111">
      <h2 style="color:#0f172a;margin-bottom:8px">${subject}</h2>
      <p style="color:#374151">${intro}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <tr><td style="padding:6px 8px;color:#6b7280">מוצר</td><td style="padding:6px 8px;font-weight:600">${productName}</td></tr>
        ${payload.product_sku ? `<tr><td style="padding:6px 8px;color:#6b7280">מק"ט</td><td style="padding:6px 8px;font-family:monospace">${payload.product_sku}</td></tr>` : ""}
        <tr><td style="padding:6px 8px;color:#6b7280">חטיבה</td><td style="padding:6px 8px">${division}</td></tr>
        ${payload.quantity != null ? `<tr><td style="padding:6px 8px;color:#6b7280">כמות</td><td style="padding:6px 8px">${payload.quantity}</td></tr>` : ""}
        ${payload.urgency ? `<tr><td style="padding:6px 8px;color:#6b7280">דחיפות</td><td style="padding:6px 8px">${payload.urgency}</td></tr>` : ""}
      </table>
      ${payload.comment_body
        ? `<blockquote style="margin-top:16px;padding:12px;border-right:3px solid #6366f1;background:#eef2ff;color:#3730a3;">${payload.comment_body}</blockquote>`
        : ""}
    </div>
  `;
  return { subject, html };
}

// Web Push helpers — minimal implementation (VAPID JWT signing)
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapid: { publicKey: string; privateKey: string; subject: string },
): Promise<{ ok: boolean; status: number; body?: string }> {
  // Use the standard webpush via deno-friendly library
  const { default: webpush } = await import("https://esm.sh/web-push@3.6.7?target=denonext");
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  try {
    const res = await webpush.sendNotification(subscription, payload);
    return { ok: true, status: res.statusCode ?? 200, body: res.body };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    return { ok: false, status: e.statusCode ?? 500, body: e.body ?? e.message };
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:notifications@cobra-system.com";
  const pushEnabled = !!(vapidPublic && vapidPrivate);

  // Pull a batch of pending notifications
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

  let sent = 0, failed = 0, skipped = 0;

  for (const row of (queue ?? []) as QueueRow[]) {
    try {
      // Resolve recipients
      let recipientIds: string[] = [];
      if (row.recipient_user_id) {
        recipientIds = [row.recipient_user_id];
      } else if (row.recipient_role === "MANAGER") {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "MANAGER");
        recipientIds = (data ?? []).map((r: { id: string }) => r.id);
      } else if (row.recipient_role === "DIVISION_MANAGER" && row.recipient_division) {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("division", row.recipient_division)
          .neq("role", "MANAGER");
        recipientIds = (data ?? []).map((r: { id: string }) => r.id);
      }

      if (recipientIds.length === 0) {
        await supabase.from("notification_queue")
          .update({ status: "skipped", attempts: row.attempts + 1, last_error: "no recipients" })
          .eq("id", row.id);
        skipped++;
        continue;
      }

      // Resolve active subscriptions
      const { data: subs } = await supabase
        .from("notification_subscriptions")
        .select("id,user_id,channel,config,is_active")
        .in("user_id", recipientIds)
        .eq("is_active", true);

      const subscriptions = (subs ?? []) as SubRow[];
      if (subscriptions.length === 0) {
        await supabase.from("notification_queue")
          .update({ status: "skipped", attempts: row.attempts + 1, last_error: "no active subscriptions" })
          .eq("id", row.id);
        skipped++;
        continue;
      }

      const { subject, html } = buildEmailHtml(row.event_type, row.payload);
      const pushPayload = JSON.stringify({
        title: subject,
        body: row.payload.product_name ?? "",
        data: { request_id: row.payload.request_id ?? null, url: "/orders" },
      });

      let anyDelivered = false;
      const errors: string[] = [];

      for (const sub of subscriptions) {
        try {
          if (sub.channel === "email") {
            const email = (sub.config as { email?: string }).email;
            if (!email) continue;
            await sendEmail({ to: email, subject, html });
            anyDelivered = true;
          } else if (sub.channel === "push" && pushEnabled) {
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
              // 410 = endpoint expired/unsubscribed
              if (result.status === 404 || result.status === 410) {
                await supabase.from("notification_subscriptions")
                  .update({ is_active: false }).eq("id", sub.id);
              }
            }
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }

      if (anyDelivered) {
        await supabase.from("notification_queue")
          .update({
            status: "sent",
            attempts: row.attempts + 1,
            sent_at: new Date().toISOString(),
            last_error: errors.length > 0 ? `partial: ${errors.join("; ")}` : null,
          })
          .eq("id", row.id);
        sent++;
      } else {
        await supabase.from("notification_queue")
          .update({
            status: row.attempts >= 3 ? "failed" : "pending",
            attempts: row.attempts + 1,
            last_error: errors.join("; ") || "no successful delivery",
          })
          .eq("id", row.id);
        failed++;
      }
    } catch (err) {
      await supabase.from("notification_queue")
        .update({
          status: row.attempts >= 3 ? "failed" : "pending",
          attempts: row.attempts + 1,
          last_error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed: queue?.length ?? 0, sent, failed, skipped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
