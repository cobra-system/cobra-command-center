import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { sendEmail, buildDailyDigestHtml } from "../_shared/email.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Authenticate via static cron secret
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || token !== cronSecret) {
    return new Response(
      JSON.stringify({ error: "לא מורשה" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    // Load digest config
    const { data: cfg, error: cfgErr } = await supabase
      .from("notification_digest_config")
      .select("*")
      .limit(1)
      .single();

    if (cfgErr || !cfg) {
      return new Response(
        JSON.stringify({ error: "שגיאה בטעינת הגדרות התראות" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cfg.digest_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: "שליחת דוח יומי מושבתת בהגדרות" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check day of week (Israel time = UTC+2/UTC+3)
    const now = new Date();
    const israelOffset = isDST(now) ? 3 : 2;
    const israelDate = new Date(now.getTime() + israelOffset * 60 * 60 * 1000);
    const todayDow = israelDate.getUTCDay(); // 0=Sun ... 6=Sat

    if (!(cfg.days_of_week as number[]).includes(todayDow)) {
      return new Response(
        JSON.stringify({ success: true, message: `לא מוגדר לשלוח ביום ${todayDow}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const todayStr = israelDate.toISOString().split("T")[0];
    const paymentDeadline = new Date(israelDate);
    paymentDeadline.setDate(israelDate.getDate() + (cfg.payment_days_ahead as number));
    const deadlineStr = paymentDeadline.toISOString().split("T")[0];

    // Fetch overdue active orders
    const overdueOrders: { id: string; items: string; supplier: string; etaDaysAgo: number }[] = [];
    if (cfg.include_overdue_orders) {
      const { data: overdueRaw } = await supabase
        .from("orders")
        .select("id, supplier_name, eta, order_items(name)")
        .lt("eta", todayStr)
        .not("status", "in", '("ARRIVED","CANCELLED")')
        .order("eta", { ascending: true });

      for (const o of overdueRaw ?? []) {
        const items = ((o as Record<string, unknown>).order_items as { name: string }[] ?? [])
          .map(i => i.name).join(", ") || "ללא פריטים";
        const etaDaysAgo = Math.floor(
          (israelDate.getTime() - new Date((o as Record<string, unknown>).eta as string).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        overdueOrders.push({
          id: (o as Record<string, unknown>).id as string,
          items,
          supplier: ((o as Record<string, unknown>).supplier_name as string) ?? "—",
          etaDaysAgo,
        });
      }
    }

    // Fetch upcoming pending payments
    const upcomingPayments: { orderId: string; supplier: string; amount: number; currency: string; daysLeft: number }[] = [];
    if (cfg.include_upcoming_payments) {
      const { data: paymentsRaw } = await supabase
        .from("order_payments")
        .select("order_id, amount, currency, due_date, orders(supplier_name)")
        .eq("status", "ממתין")
        .gte("due_date", todayStr)
        .lte("due_date", deadlineStr)
        .order("due_date", { ascending: true });

      for (const p of paymentsRaw ?? []) {
        const pr = p as Record<string, unknown>;
        const ord = pr.orders as Record<string, unknown> | null;
        const daysLeft = Math.ceil(
          (new Date(pr.due_date as string).getTime() - israelDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        upcomingPayments.push({
          orderId: pr.order_id as string,
          supplier: (ord?.supplier_name as string) ?? "—",
          amount: pr.amount as number,
          currency: pr.currency as string,
          daysLeft,
        });
      }
    }

    if (overdueOrders.length === 0 && upcomingPayments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "אין התראות לשליחה היום" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch enabled recipients from notification_recipients table
    const { data: recipientsRaw } = await supabase
      .from("notification_recipients")
      .select("profile_id, external_email")
      .eq("is_enabled", true);

    const emails: string[] = [];

    for (const r of recipientsRaw ?? []) {
      const rec = r as Record<string, unknown>;
      if (rec.external_email) {
        emails.push(rec.external_email as string);
      } else if (rec.profile_id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(rec.profile_id as string);
        if (authUser?.user?.email) emails.push(authUser.user.email);
      }
    }

    // Fallback: if no recipients configured, send to all managers
    if (emails.length === 0) {
      const { data: managers } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "MANAGER");

      for (const m of managers ?? []) {
        const { data: authUser } = await supabase.auth.admin.getUserById(
          (m as Record<string, unknown>).id as string
        );
        if (authUser?.user?.email) emails.push(authUser.user.email);
      }
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "לא נמצאו נמענים מוגדרים" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dateLabel = israelDate.toLocaleDateString("he-IL", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const html = buildDailyDigestHtml({ overdueOrders, upcomingPayments, date: dateLabel });
    const subject = `[Cobra] דוח יומי — ${overdueOrders.length} איחורים, ${upcomingPayments.length} תשלומים קרובים`;

    for (const email of emails) {
      await sendEmail({ to: email, subject, html });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_to: emails,
        overdue: overdueOrders.length,
        payments: upcomingPayments.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Approximate Israel DST detection (last Sun of March → last Sun of October)
function isDST(date: Date): boolean {
  const year = date.getUTCFullYear();
  const lastSunMarch = lastSundayOf(year, 2);   // March = month 2
  const lastSunOctober = lastSundayOf(year, 9); // October = month 9
  return date >= lastSunMarch && date < lastSunOctober;
}

function lastSundayOf(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  return d;
}
