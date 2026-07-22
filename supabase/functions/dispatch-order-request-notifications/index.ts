// Dispatch pending notifications from notification_queue:
//   • Email via Resend (HTML, RTL Hebrew)
//   • Web Push via VAPID
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

interface SubRow {
  id: string;
  user_id: string;
  channel: "email" | "push";
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
  order_request_created: "בקשת הזמנה חדשה",
  order_request_urgent: "בקשת הזמנה דחופה",
  order_request_fulfilled: "הבקשה שלך הוזמנה",
  order_request_rejected: "הבקשה שלך נדחתה",
  order_request_commented: "תגובה חדשה בבקשה",
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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Load all config in parallel (env var, then app_config fallback)
  const [resendKey, resendFrom, vapidPublic, vapidPrivate, vapidSubject] = await Promise.all([
    loadConfig(supabase, "resend_api_key", "RESEND_API_KEY"),
    loadConfig(supabase, "resend_from_email", "RESEND_FROM_EMAIL"),
    loadConfig(supabase, "vapid_public_key", "VAPID_PUBLIC_KEY"),
    loadConfig(supabase, "vapid_private_key", "VAPID_PRIVATE_KEY"),
    loadConfig(supabase, "vapid_subject", "VAPID_SUBJECT"),
  ]);

  const fromAddr = resendFrom || "notifications@cobra-system.com";
  const emailEnabled = !!resendKey;
  const pushEnabled = !!(vapidPublic && vapidPrivate && vapidSubject);

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
  const skipped = 0;

  for (const row of (queue ?? []) as QueueRow[]) {
    try {
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

      let subscriptions: SubRow[] = [];
      if (recipientIds.length > 0) {
        const { data: subs } = await supabase
          .from("notification_subscriptions")
          .select("id,user_id,channel,config,is_active")
          .in("user_id", recipientIds)
          .eq("is_active", true);
        subscriptions = (subs ?? []) as SubRow[];
      }
      const pushPayload = JSON.stringify({
        title: subject,
        body: row.payload.product_name ?? "",
        data: { request_id: row.payload.request_id ?? null, url: "/orders" },
      });

      let anyDelivered = false;
      const errors: string[] = [];

      for (const sub of subscriptions) {
        try {
          if (sub.channel === "email" && emailEnabled) {
            const email = (sub.config as { email?: string }).email;
            if (!email) continue;
            await sendResendEmail(resendKey, fromAddr, email, subject, html);
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

      // Always forward every order request event to george@cobra.co.il
      if (emailEnabled) {
        try {
          await sendResendEmail(resendKey, fromAddr, GEORGE_EMAIL, subject, html);
          anyDelivered = true;
        } catch (err) {
          errors.push(`george: ${err instanceof Error ? err.message : String(err)}`);
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

  return new Response(JSON.stringify({
    processed: queue?.length ?? 0, sent, failed, skipped,
    config: { emailEnabled, pushEnabled },
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
