import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerOrderPaymentTools(server: McpServer) {
  server.tool(
    "add_order_payment",
    "הוספת תשלום להזמנה — Add a payment installment to an order's payment schedule",
    {
      order_id: z.string().uuid().describe("Order UUID"),
      payment_type: z.enum(["Deposit", "Balance", "Full"]).describe("Payment type: Deposit (upfront), Balance (remaining), Full (single payment)"),
      amount: z.number().describe("Payment amount"),
      currency: z.enum(["USD", "EUR", "ILS"]).default("USD").describe("Currency"),
      percentage: z.number().min(0).max(100).optional().describe("Percentage of order total this payment represents (e.g. 15 for 15%)"),
      due_date: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
      paid_date: z.string().optional().describe("Date payment was made (YYYY-MM-DD) — leave empty if not yet paid"),
      swift_reference: z.string().optional().describe("SWIFT/wire transfer reference number from bank"),
      status: z.enum(["ממתין", "שולם"]).default("ממתין").describe("Payment status: ממתין (pending), שולם (paid)"),
      notes: z.string().optional().describe("Payment notes"),
    },
    async ({ order_id, payment_type, amount, currency, percentage, due_date, paid_date, swift_reference, status, notes }) => {
      const { data, error } = await supabase
        .from("order_payments")
        .insert({
          order_id,
          payment_type,
          amount,
          currency,
          percentage: percentage ?? null,
          due_date: due_date || null,
          paid_date: paid_date || null,
          swift_reference: swift_reference || null,
          status,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // Also update the order's legacy payment_status for backward compatibility
      if (status === "שולם" || paid_date) {
        const { data: allPayments } = await supabase
          .from("order_payments")
          .select("payment_type, status, paid_date")
          .eq("order_id", order_id);

        const payments = allPayments || [];
        const hasFullOrBalance = payments.some(
          (p: Record<string, unknown>) =>
            (p.payment_type === "Full" || p.payment_type === "Balance") &&
            (p.status === "שולם" || p.paid_date)
        );
        const hasDeposit = payments.some(
          (p: Record<string, unknown>) =>
            p.payment_type === "Deposit" && (p.status === "שולם" || p.paid_date)
        );

        const legacyStatus = hasFullOrBalance ? "שולם" : hasDeposit ? "שולם פיקדון" : "ממתין";
        await supabase.from("orders").update({ payment_status: legacyStatus }).eq("id", order_id);
      }

      return { content: [{ type: "text" as const, text: `Payment added:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_order_payments",
    "לוח תשלומים להזמנה — List all payment installments for an order with totals",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      const [orderRes, paymentsRes] = await Promise.all([
        supabase.from("orders").select("id, supplier_name, total_price, payment_status, pi_number").eq("id", order_id).single(),
        supabase.from("order_payments").select("*").eq("order_id", order_id).order("created_at", { ascending: true }),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error fetching order: ${orderRes.error.message}` }] };

      const payments = paymentsRes.data || [];
      const totalPaid = payments
        .filter((p: Record<string, unknown>) => p.status === "שולם" || p.paid_date)
        .reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);
      const totalPending = payments
        .filter((p: Record<string, unknown>) => p.status === "ממתין" && !p.paid_date)
        .reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);

      const result = {
        order: orderRes.data,
        payment_schedule: payments,
        summary: {
          total_installments: payments.length,
          total_paid: totalPaid,
          total_pending: totalPending,
          order_total: Number(orderRes.data.total_price) || null,
          remaining_from_order_total: orderRes.data.total_price
            ? Number(orderRes.data.total_price) - totalPaid
            : null,
        },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_order_payment_schedule",
    "לוח זמנים לתשלומים — Get the full payment schedule for an order (what needs to be paid and when)",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      const [orderRes, paymentsRes] = await Promise.all([
        supabase.from("orders").select("id, supplier_name, total_price, status, pi_number, eta, etd").eq("id", order_id).single(),
        supabase.from("order_payments").select("*").eq("order_id", order_id).order("created_at", { ascending: true }),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error: ${orderRes.error.message}` }] };

      const payments = paymentsRes.data || [];
      const today = new Date().toISOString().split("T")[0];

      type ScheduleEntry = Record<string, unknown> & { is_paid: boolean; is_overdue: unknown; days_until_due: number | null };

      const schedule: ScheduleEntry[] = payments.map((p: Record<string, unknown>) => {
        const isPaid = p.status === "שולם" || Boolean(p.paid_date);
        const isOverdue = !isPaid && p.due_date && (p.due_date as string) < today;
        return {
          ...p,
          is_paid: isPaid,
          is_overdue: isOverdue,
          days_until_due: p.due_date
            ? Math.ceil((new Date(p.due_date as string).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
            : null,
        };
      });

      const pendingPayments = schedule.filter((p) => !p.is_paid);
      const overduePayments = schedule.filter((p) => p.is_overdue);
      const paidPayments = schedule.filter((p) => p.is_paid);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            order: orderRes.data,
            schedule,
            pending_count: pendingPayments.length,
            overdue_count: overduePayments.length,
            paid_count: paidPayments.length,
            total_pending_amount: pendingPayments.reduce((s, p) => s + (Number(p.amount as number) || 0), 0),
            total_paid_amount: paidPayments.reduce((s, p) => s + (Number(p.amount as number) || 0), 0),
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "update_order_payment",
    "עדכון תשלום — Update a payment installment (mark as paid, add SWIFT reference, change amount)",
    {
      id: z.string().uuid().describe("Order payment UUID"),
      status: z.enum(["ממתין", "שולם"]).optional().describe("Payment status"),
      paid_date: z.string().optional().describe("Date payment was made (YYYY-MM-DD)"),
      swift_reference: z.string().optional().describe("SWIFT/wire transfer reference number"),
      amount: z.number().optional().describe("Updated payment amount"),
      due_date: z.string().optional().describe("Updated due date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Updated notes"),
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
        .from("order_payments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // If marking as paid, update legacy order payment_status
      if (updates.status === "שולם" || updates.paid_date) {
        const orderId = data.order_id as string;
        const { data: allPayments } = await supabase
          .from("order_payments")
          .select("payment_type, status, paid_date")
          .eq("order_id", orderId);

        const payments = allPayments || [];
        const hasFullOrBalance = payments.some(
          (p: Record<string, unknown>) =>
            (p.payment_type === "Full" || p.payment_type === "Balance") &&
            (p.status === "שולם" || p.paid_date)
        );
        const hasDeposit = payments.some(
          (p: Record<string, unknown>) =>
            p.payment_type === "Deposit" && (p.status === "שולם" || p.paid_date)
        );

        const legacyStatus = hasFullOrBalance ? "שולם" : hasDeposit ? "שולם פיקדון" : "ממתין";
        await supabase.from("orders").update({ payment_status: legacyStatus }).eq("id", orderId);
      }

      return { content: [{ type: "text" as const, text: `Payment updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "match_swift_to_payment",
    "התאמת SWIFT לתשלום — Search for a pending order payment matching a SWIFT transfer amount",
    {
      amount: z.number().describe("Payment amount from bank statement"),
      currency: z.enum(["USD", "EUR", "ILS"]).default("USD").describe("Currency"),
      tolerance_percent: z.number().default(1).describe("Amount tolerance % for fuzzy matching (default 1%)"),
      supplier_name: z.string().optional().describe("Supplier/beneficiary name (partial match)"),
      date: z.string().optional().describe("Transfer date (YYYY-MM-DD) — used to filter orders by period"),
      swift_reference: z.string().optional().describe("SWIFT reference if already known — will be saved to matched payment"),
    },
    async ({ amount, currency, tolerance_percent, supplier_name, date, swift_reference }) => {
      const tolerance = amount * (tolerance_percent / 100);
      const minAmount = amount - tolerance;
      const maxAmount = amount + tolerance;

      let query = supabase
        .from("order_payments")
        .select("*, orders!inner(id, supplier_name, pi_number, status, total_price)")
        .eq("currency", currency)
        .gte("amount", minAmount)
        .lte("amount", maxAmount)
        .eq("status", "ממתין");

      if (supplier_name) {
        query = query.ilike("orders.supplier_name", `%${supplier_name}%`);
      }

      const { data: matches, error } = await query;

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      if (!matches || matches.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: [
              `No pending order payments found matching ${amount} ${currency} (±${tolerance_percent}%).`,
              supplier_name ? `Supplier filter: "${supplier_name}"` : "",
              "",
              "Try: broaden the tolerance, check the currency, or verify the amount.",
            ].filter(Boolean).join("\n"),
          }],
        };
      }

      const result: Record<string, unknown> = {
        search: { amount, currency, tolerance_percent, supplier_name },
        matches_found: matches.length,
        matches,
      };

      // If SWIFT reference provided and exactly one match found, offer to update it
      if (swift_reference && matches.length === 1) {
        const paymentId = (matches[0] as Record<string, unknown>).id as string;
        const { data: updated, error: updateErr } = await supabase
          .from("order_payments")
          .update({ swift_reference })
          .eq("id", paymentId)
          .select()
          .single();

        if (updateErr) {
          result.swift_update_error = updateErr.message;
        } else {
          result.swift_reference_saved = true;
          result.updated_payment = updated;
        }
      } else if (swift_reference && matches.length > 1) {
        result.swift_note = `Multiple matches found — cannot auto-assign SWIFT reference. Use update_order_payment with the specific payment ID.`;
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
