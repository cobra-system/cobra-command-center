import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerPaymentTools(server: McpServer) {
  server.tool(
    "create_supplier_payment",
    "רישום תשלום לספק — Record a supplier payment (deposit, balance, or full)",
    {
      supplier_id: z.string().uuid().describe("Supplier UUID"),
      order_id: z.string().uuid().optional().describe("Order UUID"),
      amount: z.number().describe("Payment amount"),
      currency: z.enum(["USD", "EUR", "ILS"]).default("USD").describe("Currency"),
      payment_type: z.enum(["Deposit", "Balance", "Full"]).default("Full").describe("Payment type"),
      status: z.enum(["ממתין", "שולם פיקדון", "שולם"]).default("ממתין").describe("Payment status: ממתין (pending), שולם פיקדון (deposit paid), שולם (fully paid)"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      paid_date: z.string().optional().describe("Paid date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Payment notes"),
    },
    async ({ supplier_id, order_id, amount, currency, payment_type, status, due_date, paid_date, notes }) => {
      const { data, error } = await supabase
        .from("supplier_payments")
        .insert({
          supplier_id,
          order_id: order_id ?? null,
          amount,
          currency,
          payment_type,
          status,
          due_date: due_date ?? null,
          paid_date: paid_date ?? null,
          notes: notes ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Payment recorded:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_supplier_payments",
    "היסטוריית תשלומים לספק — List payments for a supplier with optional filters",
    {
      supplier_id: z.string().uuid().describe("Supplier UUID"),
      order_id: z.string().uuid().optional().describe("Filter by order UUID"),
      status: z.enum(["ממתין", "שולם פיקדון", "שולם"]).optional().describe("Filter by payment status: ממתין (pending), שולם פיקדון (deposit paid), שולם (fully paid)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ supplier_id, order_id, status, limit }) => {
      let query = supabase
        .from("supplier_payments")
        .select("*")
        .eq("supplier_id", supplier_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (order_id) query = query.eq("order_id", order_id);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_payment_status",
    "בדיקת מצב תשלום — Check what has been paid and what remains for an order",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      const [orderRes, paymentsRes, orderPaymentsRes] = await Promise.all([
        supabase.from("orders").select("id, total_price, supplier_name").eq("id", order_id).single(),
        supabase.from("supplier_payments").select("*").eq("order_id", order_id).order("created_at", { ascending: true }),
        supabase.from("order_payments").select("id, payment_type, amount, currency, status, paid_date, due_date, swift_reference").eq("order_id", order_id).order("created_at", { ascending: true }),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error fetching order: ${orderRes.error.message}` }] };

      const payments = paymentsRes.data || [];
      const schedule = orderPaymentsRes.data || [];
      const schedulePaid = schedule
        .filter((p: Record<string, unknown>) => p.status === "שולם")
        .reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);
      const scheduleTotal = schedule.reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);

      const orderTotal = Number(orderRes.data.total_price) || 0;
      const derivedStatus = schedule.length === 0 ? "ממתין" : schedulePaid === 0 ? "ממתין" : schedulePaid >= scheduleTotal ? "שולם" : "שולם חלקי";

      const result = {
        order_id,
        supplier_name: orderRes.data.supplier_name,
        order_total: orderTotal,
        payment_status: derivedStatus,
        payment_schedule: schedule,
        schedule_total: scheduleTotal,
        schedule_paid: schedulePaid,
        schedule_remaining: scheduleTotal - schedulePaid,
        supplier_payments_history: payments,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_supplier_payment",
    "עדכון תשלום לספק — Update a supplier payment record",
    {
      id: z.string().uuid().describe("Payment UUID"),
      status: z.enum(["ממתין", "שולם פיקדון", "שולם"]).optional().describe("Payment status: ממתין (pending), שולם פיקדון (deposit paid), שולם (fully paid)"),
      amount: z.number().optional().describe("Payment amount"),
      currency: z.enum(["USD", "EUR", "ILS"]).optional().describe("Currency"),
      payment_type: z.enum(["Deposit", "Balance", "Full"]).optional().describe("Payment type"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      paid_date: z.string().optional().describe("Paid date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Payment notes"),
    },
    async ({ id, ...fields }) => {
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updates[key] = value;
      }

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }

      const { data, error } = await supabase
        .from("supplier_payments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Payment updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );
}
