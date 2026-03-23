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
      status: z.string().default("ממתין").describe("Payment status"),
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
      status: z.string().optional().describe("Filter by payment status"),
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
      const [orderRes, paymentsRes] = await Promise.all([
        supabase.from("orders").select("id, total_price, payment_status, supplier_name").eq("id", order_id).single(),
        supabase.from("supplier_payments").select("*").eq("order_id", order_id).order("created_at", { ascending: true }),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error fetching order: ${orderRes.error.message}` }] };

      const payments = paymentsRes.data || [];
      const totalPaid = payments
        .filter((p: Record<string, unknown>) => p.status === "שולם" || p.paid_date)
        .reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);

      const orderTotal = Number(orderRes.data.total_price) || 0;
      const remaining = orderTotal - totalPaid;

      const result = {
        order_id,
        supplier_name: orderRes.data.supplier_name,
        order_total: orderTotal,
        payment_status: orderRes.data.payment_status,
        total_paid: totalPaid,
        remaining_balance: remaining,
        payments,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
