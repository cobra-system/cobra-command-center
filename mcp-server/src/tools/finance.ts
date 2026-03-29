import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerFinanceTools(server: McpServer) {
  server.tool(
    "get_payment_summary",
    "סיכום תשלומים — Total paid/pending/overdue by period",
    {
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
    },
    async ({ date_from, date_to }) => {
      let query = supabase.from("supplier_payments").select("*").order("created_at", { ascending: false });

      if (date_from) query = query.gte("created_at", date_from);
      if (date_to) query = query.lte("created_at", date_to + "T23:59:59");

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const payments = data || [];
      const today = new Date().toISOString().split("T")[0];

      const paid = payments.filter((p: Record<string, unknown>) => p.status === "שולם" || p.paid_date);
      const pending = payments.filter((p: Record<string, unknown>) => (p.status === "ממתין" || p.status === "pending") && (!p.due_date || (p.due_date as string) >= today));
      const overdue = payments.filter((p: Record<string, unknown>) => (p.status === "ממתין" || p.status === "pending") && p.due_date && (p.due_date as string) < today);

      const sum = (arr: Record<string, unknown>[]) => arr.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      // Group by currency
      const byCurrency: Record<string, { paid: number; pending: number; overdue: number }> = {};
      for (const p of payments) {
        const currency = (p.currency as string) || "USD";
        if (!byCurrency[currency]) byCurrency[currency] = { paid: 0, pending: 0, overdue: 0 };
      }
      for (const p of paid) {
        const c = (p.currency as string) || "USD";
        if (!byCurrency[c]) byCurrency[c] = { paid: 0, pending: 0, overdue: 0 };
        byCurrency[c].paid += Number(p.amount) || 0;
      }
      for (const p of pending) {
        const c = (p.currency as string) || "USD";
        if (!byCurrency[c]) byCurrency[c] = { paid: 0, pending: 0, overdue: 0 };
        byCurrency[c].pending += Number(p.amount) || 0;
      }
      for (const p of overdue) {
        const c = (p.currency as string) || "USD";
        if (!byCurrency[c]) byCurrency[c] = { paid: 0, pending: 0, overdue: 0 };
        byCurrency[c].overdue += Number(p.amount) || 0;
      }

      const result = {
        total_payments: payments.length,
        paid: { count: paid.length, total: sum(paid) },
        pending: { count: pending.length, total: sum(pending) },
        overdue: { count: overdue.length, total: sum(overdue) },
        by_currency: byCurrency,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_supplier_balance",
    "יתרת ספק — Outstanding balance per supplier",
    {
      supplier_id: z.string().uuid().optional().describe("Specific supplier UUID (omit for all)"),
      limit: z.number().default(50).describe("Max suppliers"),
    },
    async ({ supplier_id, limit }) => {
      let suppliersQuery = supabase.from("suppliers").select("id, company").order("company").limit(limit);
      if (supplier_id) suppliersQuery = suppliersQuery.eq("id", supplier_id);

      const { data: suppliers, error: suppError } = await suppliersQuery;
      if (suppError) return { content: [{ type: "text" as const, text: `Error: ${suppError.message}` }] };

      const supplierIds = (suppliers || []).map((s: Record<string, unknown>) => s.id as string);
      if (supplierIds.length === 0) return { content: [{ type: "text" as const, text: "No suppliers found" }] };

      const [ordersRes, paymentsRes] = await Promise.all([
        supabase.from("orders").select("id, supplier_id, total_price").in("supplier_id", supplierIds),
        supabase.from("supplier_payments").select("id, supplier_id, amount, status, paid_date").in("supplier_id", supplierIds),
      ]);

      const orders = ordersRes.data || [];
      const payments = paymentsRes.data || [];

      const balances = (suppliers || []).map((s: Record<string, unknown>) => {
        const supplierOrders = orders.filter((o: Record<string, unknown>) => o.supplier_id === s.id);
        const totalOrdered = supplierOrders.reduce((sum: number, o: Record<string, unknown>) => sum + (Number(o.total_price) || 0), 0);

        const supplierPayments = payments.filter((p: Record<string, unknown>) => p.supplier_id === s.id);
        const totalPaid = supplierPayments
          .filter((p: Record<string, unknown>) => p.status === "שולם" || p.paid_date)
          .reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);

        return {
          supplier_id: s.id,
          company: s.company,
          total_ordered: totalOrdered,
          total_paid: totalPaid,
          outstanding_balance: totalOrdered - totalPaid,
          order_count: supplierOrders.length,
        };
      }).filter(b => b.outstanding_balance !== 0 || b.order_count > 0);

      const totalOutstanding = balances.reduce((sum, b) => sum + b.outstanding_balance, 0);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ total_outstanding: totalOutstanding, suppliers: balances }, null, 2) }],
      };
    }
  );

  server.tool(
    "forecast_upcoming_payments",
    "תחזית תשלומים — Payments due in the next N days",
    {
      days_ahead: z.number().default(30).describe("Number of days to look ahead"),
    },
    async ({ days_ahead }) => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const futureDate = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("supplier_payments")
        .select("*, suppliers(company)")
        .in("status", ["ממתין", "pending"])
        .gte("due_date", today)
        .lte("due_date", futureDate)
        .order("due_date");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const payments = data || [];
      const totalDue = payments.reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);

      // Group by week
      const byWeek: Record<string, { count: number; total: number }> = {};
      for (const p of payments) {
        const dueDate = new Date(p.due_date as string);
        const weekStart = new Date(dueDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];
        if (!byWeek[weekKey]) byWeek[weekKey] = { count: 0, total: 0 };
        byWeek[weekKey].count++;
        byWeek[weekKey].total += Number(p.amount) || 0;
      }

      const result = {
        period: `${today} to ${futureDate}`,
        total_payments_due: payments.length,
        total_amount_due: totalDue,
        by_week: byWeek,
        payments: payments.map((p: Record<string, unknown>) => ({
          id: p.id,
          supplier: (p.suppliers as Record<string, unknown>)?.company,
          amount: p.amount,
          currency: p.currency,
          due_date: p.due_date,
          payment_type: p.payment_type,
        })),
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_currency_exposure",
    "חשיפה מטבעית — Breakdown of payments and orders by currency",
    {},
    async () => {
      const [paymentsRes, ordersRes] = await Promise.all([
        supabase.from("supplier_payments").select("amount, currency, status, paid_date"),
        supabase.from("orders").select("total_price, currency"),
      ]);

      const payments = paymentsRes.data || [];
      const orders = ordersRes.data || [];

      const exposure: Record<string, { total_ordered: number; total_paid: number; pending: number }> = {};

      for (const order of orders) {
        const currency = (order.currency as string) || "USD";
        if (!exposure[currency]) exposure[currency] = { total_ordered: 0, total_paid: 0, pending: 0 };
        exposure[currency].total_ordered += Number(order.total_price) || 0;
      }

      for (const payment of payments) {
        const currency = (payment.currency as string) || "USD";
        if (!exposure[currency]) exposure[currency] = { total_ordered: 0, total_paid: 0, pending: 0 };
        const amount = Number(payment.amount) || 0;
        if (payment.status === "שולם" || payment.paid_date) {
          exposure[currency].total_paid += amount;
        } else {
          exposure[currency].pending += amount;
        }
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(exposure, null, 2) }] };
    }
  );
}
