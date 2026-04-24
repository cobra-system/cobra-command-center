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

  // Authenticate via static cron secret (no user session)
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
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

    // Fetch overdue active orders (ETA < today, not arrived/cancelled)
    const { data: overdueRaw } = await supabase
      .from("orders")
      .select("id, supplier_name, eta, order_items(name)")
      .lt("eta", todayStr)
      .not("status", "in", '("ARRIVED","CANCELLED")')
      .order("eta", { ascending: true });

    const overdueOrders = (overdueRaw ?? []).map((o: Record<string, unknown>) => {
      const items = (o.order_items as { name: string }[] | null ?? []).map(i => i.name).join(", ") || "ללא פריטים";
      const etaDaysAgo = Math.floor((today.getTime() - new Date(o.eta as string).getTime()) / (1000 * 60 * 60 * 24));
      return { id: o.id as string, items, supplier: (o.supplier_name as string) ?? "—", etaDaysAgo };
    });

    // Fetch upcoming pending payments (due in next 3 days)
    const { data: paymentsRaw } = await supabase
      .from("order_payments")
      .select("order_id, amount, currency, due_date, orders(supplier_name)")
      .eq("status", "ממתין")
      .gte("due_date", todayStr)
      .lte("due_date", threeDaysStr)
      .order("due_date", { ascending: true });

    const upcomingPayments = (paymentsRaw ?? []).map((p: Record<string, unknown>) => {
      const ord = p.orders as Record<string, unknown> | null;
      const daysLeft = Math.ceil((new Date(p.due_date as string).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        orderId: p.order_id as string,
        supplier: (ord?.supplier_name as string) ?? "—",
        amount: p.amount as number,
        currency: p.currency as string,
        daysLeft,
      };
    });

    if (overdueOrders.length === 0 && upcomingPayments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "אין התראות לשליחה היום" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all manager emails
    const { data: managers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "MANAGER");

    const managerIds = (managers ?? []).map((m: Record<string, unknown>) => m.id as string);
    const emails: string[] = [];

    for (const uid of managerIds) {
      const { data: authUser } = await supabase.auth.admin.getUserById(uid);
      if (authUser?.user?.email) emails.push(authUser.user.email);
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "לא נמצאו מנהלים עם כתובת מייל" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dateLabel = today.toLocaleDateString("he-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const html = buildDailyDigestHtml({ overdueOrders, upcomingPayments, date: dateLabel });

    const subject = `[Cobra] דוח יומי — ${overdueOrders.length} איחורים, ${upcomingPayments.length} תשלומים קרובים`;

    for (const email of emails) {
      await sendEmail({ to: email, subject, html });
    }

    return new Response(
      JSON.stringify({ success: true, sent_to: emails, overdue: overdueOrders.length, payments: upcomingPayments.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
