import { supabase } from "@/lib/supabase";

const SW_PATH = "/notification-sw.js";

export function pushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function getCurrentPermission(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  return Notification.permission;
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - b64.length % 4) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  return reg;
}

/** Subscribe this device to push and persist the subscription server-side. */
export async function subscribePush(vapidPublicKey: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: "הדפדפן לא תומך ב-Push" };
  if (!vapidPublicKey) return { ok: false, error: "מפתח VAPID לא הוגדר" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, error: "ההרשאה נדחתה" };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, error: "שגיאה ברישום service worker" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  const json = sub.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "לא מחובר" };

  // Replace any existing push subscription for this user (1 device = 1 row)
  await supabase
    .from("notification_subscriptions" as any)
    .upsert({
      user_id: user.id,
      channel: "push",
      config: json,
      user_agent: navigator.userAgent,
      is_active: true,
    } as any, { onConflict: "user_id,channel" });

  return { ok: true };
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("notification_subscriptions")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("channel", "push");
  }
}

export async function setEmailNotifications(email: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (!email) {
    await supabase
      .from("notification_subscriptions")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("channel", "email");
    return;
  }
  await supabase
    .from("notification_subscriptions")
    .upsert({
      user_id: user.id,
      channel: "email",
      config: { email },
      is_active: true,
    }, { onConflict: "user_id,channel" });
}

export async function getMySubscriptions(): Promise<{ email: string | null; pushActive: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { email: null, pushActive: false };
  const { data } = await supabase
    .from("notification_subscriptions")
    .select("channel,config,is_active")
    .eq("user_id", user.id);
  let email: string | null = null;
  let pushActive = false;
  for (const row of (data ?? []) as { channel: string; config: { email?: string }; is_active: boolean }[]) {
    if (row.channel === "email" && row.is_active) email = row.config.email ?? null;
    if (row.channel === "push" && row.is_active) pushActive = true;
  }
  return { email, pushActive };
}
