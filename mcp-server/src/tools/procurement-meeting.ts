import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerProcurementMeetingTools(server: McpServer) {
  // ── add_order_to_meeting ──────────────────────────────────────────────────
  server.tool(
    "add_order_to_meeting",
    "הוספת הזמנה לישיבת רכש — Add an order to a procurement meeting agenda",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
      order_id:   z.string().uuid().describe("Order UUID"),
      notes:      z.string().optional().describe("Optional notes about this order in the meeting context"),
    },
    async ({ meeting_id, order_id, notes }) => {
      const { data, error } = await supabase
        .from("procurement_meeting_orders")
        .insert({ meeting_id, order_id, notes: notes || null, decision: "pending" })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Order added to meeting:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ── update_order_meeting_decision ─────────────────────────────────────────
  server.tool(
    "update_order_meeting_decision",
    "עדכון החלטה על הזמנה בישיבת רכש — Update the decision for an order in a procurement meeting (approved/deferred/partial/pending)",
    {
      meeting_id:      z.string().uuid().describe("Meeting UUID"),
      order_id:        z.string().uuid().describe("Order UUID"),
      decision:        z.enum(["approved", "deferred", "partial", "pending"]).describe("Decision: approved / deferred / partial / pending"),
      approved_amount: z.number().optional().describe("Approved amount (required when decision=partial)"),
      notes:           z.string().optional().describe("Notes about the decision"),
    },
    async ({ meeting_id, order_id, decision, approved_amount, notes }) => {
      const updates: Record<string, unknown> = { decision, updated_at: new Date().toISOString() };
      if (approved_amount !== undefined) updates.approved_amount = approved_amount;
      if (notes !== undefined) updates.notes = notes;

      const { data, error } = await supabase
        .from("procurement_meeting_orders")
        .update(updates)
        .eq("meeting_id", meeting_id)
        .eq("order_id", order_id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Decision updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ── get_meeting_orders ────────────────────────────────────────────────────
  server.tool(
    "get_meeting_orders",
    "הזמנות בישיבת רכש — Get all orders in a procurement meeting with full order details and decisions",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
    },
    async ({ meeting_id }) => {
      const { data: rows, error } = await supabase
        .from("procurement_meeting_orders")
        .select(`
          id,
          decision,
          approved_amount,
          notes,
          created_at,
          updated_at,
          orders!inner(
            id,
            supplier_name,
            pi_number,
            status,
            total_price,
            currency,
            priority,
            eta,
            etd,
            vessel_name,
            notes,
            created_at
          )
        `)
        .eq("meeting_id", meeting_id)
        .order("created_at", { ascending: true });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const items = (rows || []) as Record<string, unknown>[];

      // Enrich each order with its pending payments
      const orderIds = items.map(r => {
        const o = r.orders as Record<string, unknown>;
        return o.id as string;
      });

      let pendingPayments: Record<string, unknown>[] = [];
      if (orderIds.length > 0) {
        const { data: payments } = await supabase
          .from("order_payments")
          .select("order_id, payment_type, amount, currency, due_date, status, percentage")
          .in("order_id", orderIds)
          .eq("status", "ממתין");
        pendingPayments = (payments || []) as Record<string, unknown>[];
      }

      const paymentsByOrder: Record<string, unknown[]> = {};
      for (const p of pendingPayments) {
        const oid = p.order_id as string;
        if (!paymentsByOrder[oid]) paymentsByOrder[oid] = [];
        paymentsByOrder[oid].push(p);
      }

      const result = items.map(r => {
        const order = r.orders as Record<string, unknown>;
        const oid = order.id as string;
        const payments = paymentsByOrder[oid] || [];
        const totalPending = payments.reduce((sum: number, p) => sum + (Number((p as Record<string, unknown>).amount) || 0), 0);

        return {
          meeting_order_id: r.id,
          decision:         r.decision,
          approved_amount:  r.approved_amount,
          notes:            r.notes,
          order: {
            ...order,
            pending_payments: payments,
            total_pending_amount: totalPending,
            has_payment_schedule: payments.length > 0,
          },
        };
      });

      // Summary totals by decision
      const summary = {
        total: result.length,
        approved:  result.filter(r => r.decision === "approved").length,
        partial:   result.filter(r => r.decision === "partial").length,
        deferred:  result.filter(r => r.decision === "deferred").length,
        pending:   result.filter(r => r.decision === "pending").length,
        approved_total: result
          .filter(r => r.decision === "approved" || r.decision === "partial")
          .reduce((sum, r) => {
            const amt = r.approved_amount ?? (r.order as Record<string, unknown>).total_pending_amount;
            return sum + (Number(amt) || 0);
          }, 0),
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ meeting_id, summary, orders: result }, null, 2),
        }],
      };
    }
  );

  // ── close_procurement_meeting ─────────────────────────────────────────────
  server.tool(
    "close_procurement_meeting",
    "סגירת ישיבת רכש — Close a procurement meeting: sets meeting status to closed and finalises all order decisions. Does NOT mark payments as paid — payment execution is done manually.",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
    },
    async ({ meeting_id }) => {
      // 1. Verify meeting exists and is open
      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .select("id, title, status, type")
        .eq("id", meeting_id)
        .single();

      if (meetingErr) return { content: [{ type: "text" as const, text: `Error fetching meeting: ${meetingErr.message}` }] };
      if (!meeting) return { content: [{ type: "text" as const, text: "Meeting not found" }] };
      if ((meeting as Record<string, unknown>).status === "closed") {
        return { content: [{ type: "text" as const, text: "Meeting is already closed" }] };
      }

      // 2. Fetch all orders for this meeting
      const { data: meetingOrders, error: ordersErr } = await supabase
        .from("procurement_meeting_orders")
        .select("order_id, decision, approved_amount")
        .eq("meeting_id", meeting_id);

      if (ordersErr) return { content: [{ type: "text" as const, text: `Error fetching meeting orders: ${ordersErr.message}` }] };

      const orders = (meetingOrders || []) as Record<string, unknown>[];

      // 3. Close the meeting
      const { error: closeErr } = await supabase
        .from("meetings")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", meeting_id);

      if (closeErr) return { content: [{ type: "text" as const, text: `Error closing meeting: ${closeErr.message}` }] };

      // 4. Build summary of decisions
      const approved  = orders.filter(o => o.decision === "approved");
      const partial   = orders.filter(o => o.decision === "partial");
      const deferred  = orders.filter(o => o.decision === "deferred");
      const pending   = orders.filter(o => o.decision === "pending");

      const summary = {
        meeting_id,
        meeting_title: (meeting as Record<string, unknown>).title,
        status: "closed",
        decisions: {
          approved:  approved.length,
          partial:   partial.length,
          deferred:  deferred.length,
          pending:   pending.length,
          total:     orders.length,
        },
        approved_orders: approved.map(o => ({ order_id: o.order_id })),
        partial_orders:  partial.map(o => ({ order_id: o.order_id, approved_amount: o.approved_amount })),
        deferred_orders: deferred.map(o => ({ order_id: o.order_id })),
        note: "Payment execution is manual — mark individual payments as paid once Mor processes the bank transfer.",
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(summary, null, 2),
        }],
      };
    }
  );
}
