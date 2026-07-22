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

  // ── get_meeting_summary ───────────────────────────────────────────────────
  server.tool(
    "get_meeting_summary",
    "סיכום ישיבת רכש — Get a full summary of a procurement meeting: approved/deferred orders, amounts, and bank details. Replaces 10+ individual tool calls.",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
    },
    async ({ meeting_id }) => {
      // 1. Fetch meeting
      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .select("id, title, meeting_date, status, type")
        .eq("id", meeting_id)
        .single();

      if (meetingErr) return { content: [{ type: "text" as const, text: `Error: ${meetingErr.message}` }] };
      if (!meeting) return { content: [{ type: "text" as const, text: "Meeting not found" }] };

      // 2. Fetch all meeting orders with order details
      const { data: meetingOrders, error: ordersErr } = await supabase
        .from("procurement_meeting_orders")
        .select(`
          id, decision, approved_amount, notes,
          orders!inner(id, supplier_id, supplier_name, pi_number, total_price, status, eta)
        `)
        .eq("meeting_id", meeting_id)
        .order("created_at", { ascending: true });

      if (ordersErr) return { content: [{ type: "text" as const, text: `Error: ${ordersErr.message}` }] };

      const rows = (meetingOrders || []) as Record<string, unknown>[];
      const orderIds = rows.map(r => ((r.orders as Record<string, unknown>).id as string));
      const supplierIds = [...new Set(rows.map(r => ((r.orders as Record<string, unknown>).supplier_id as string)).filter(Boolean))];

      // 3. Fetch pending payments for all orders
      let pendingPayments: Record<string, unknown>[] = [];
      if (orderIds.length > 0) {
        const { data: pays } = await supabase
          .from("order_payments")
          .select("order_id, payment_type, amount, currency, due_date, status, percentage")
          .in("order_id", orderIds)
          .eq("status", "ממתין");
        pendingPayments = (pays || []) as Record<string, unknown>[];
      }

      const paysByOrder: Record<string, Record<string, unknown>[]> = {};
      for (const p of pendingPayments) {
        const oid = p.order_id as string;
        if (!paysByOrder[oid]) paysByOrder[oid] = [];
        paysByOrder[oid].push(p);
      }

      // 4. Fetch bank details for all suppliers
      let bankDetails: Record<string, unknown>[] = [];
      if (supplierIds.length > 0) {
        const { data: banks } = await supabase
          .from("supplier_bank_details")
          .select("supplier_id, beneficiary_name, bank_name, swift_code, account_number, currency")
          .in("supplier_id", supplierIds);
        bankDetails = (banks || []) as Record<string, unknown>[];
      }
      const bankBySupplier: Record<string, Record<string, unknown>> = {};
      for (const b of bankDetails) {
        bankBySupplier[b.supplier_id as string] = b;
      }

      // 5. Build approved / deferred lists
      const approved: Record<string, unknown>[] = [];
      const deferred: Record<string, unknown>[] = [];
      let totalApproved = 0;
      let totalDeferred = 0;

      for (const r of rows) {
        const order = r.orders as Record<string, unknown>;
        const oid = order.id as string;
        const sid = order.supplier_id as string;
        const pays = paysByOrder[oid] || [];
        const pendingTotal = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const approvedAmt = r.approved_amount != null
          ? Number(r.approved_amount)
          : (r.decision === "approved" ? pendingTotal : null);
        const currency = (pays[0] as Record<string, unknown> | undefined)?.currency ?? "USD";

        if (r.decision === "approved" || r.decision === "partial") {
          const amt = approvedAmt ?? 0;
          totalApproved += amt;
          approved.push({
            order_id:        oid,
            supplier_name:   order.supplier_name,
            pi_number:       order.pi_number,
            approved_amount: amt,
            currency,
            payment_type:    (pays[0] as Record<string, unknown> | undefined)?.payment_type ?? null,
            bank_details:    bankBySupplier[sid] ?? null,
          });
        } else if (r.decision === "deferred") {
          const amt = pendingTotal || Number(order.total_price) || 0;
          totalDeferred += amt;
          deferred.push({
            order_id:      oid,
            supplier_name: order.supplier_name,
            pi_number:     order.pi_number,
            amount:        amt,
            currency,
            reason:        r.notes ?? null,
          });
        }
      }

      const result = {
        meeting: {
          id:     (meeting as Record<string, unknown>).id,
          title:  (meeting as Record<string, unknown>).title,
          date:   (meeting as Record<string, unknown>).meeting_date,
          status: (meeting as Record<string, unknown>).status,
        },
        approved,
        deferred,
        pending: rows.filter(r => r.decision === "pending").map(r => {
          const order = r.orders as Record<string, unknown>;
          return { order_id: order.id, supplier_name: order.supplier_name, pi_number: order.pi_number };
        }),
        totals: {
          approved: totalApproved,
          deferred: totalDeferred,
          orders_count: rows.length,
          approved_count: approved.length,
          deferred_count: deferred.length,
          pending_count:  rows.filter(r => r.decision === "pending").length,
        },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── bulk_update_meeting_decisions ─────────────────────────────────────────
  server.tool(
    "bulk_update_meeting_decisions",
    "עדכון החלטות ישיבת רכש בבת אחת — Update multiple order decisions in a single call",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
      decisions: z.array(z.object({
        order_id:        z.string().uuid().describe("Order UUID"),
        decision:        z.enum(["approved", "deferred", "partial", "pending"]).describe("Decision"),
        approved_amount: z.number().optional().describe("Amount approved (for partial/approved)"),
        notes:           z.string().optional().describe("Decision notes"),
      })).describe("Array of decisions to apply"),
    },
    async ({ meeting_id, decisions }) => {
      const results: Record<string, unknown>[] = [];
      const errors: string[] = [];

      for (const d of decisions) {
        const updates: Record<string, unknown> = {
          decision:    d.decision,
          updated_at:  new Date().toISOString(),
        };
        if (d.approved_amount !== undefined) updates.approved_amount = d.approved_amount;
        if (d.notes !== undefined) updates.notes = d.notes;

        const { data, error } = await supabase
          .from("procurement_meeting_orders")
          .update(updates)
          .eq("meeting_id", meeting_id)
          .eq("order_id", d.order_id)
          .select("id, order_id, decision, approved_amount")
          .single();

        if (error) {
          errors.push(`order ${d.order_id}: ${error.message}`);
        } else {
          results.push(data as Record<string, unknown>);
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ updated: results.length, errors, results }, null, 2),
        }],
      };
    }
  );

  // ── get_pending_orders_for_meeting ────────────────────────────────────────
  server.tool(
    "get_pending_orders_for_meeting",
    "הזמנות הממתינות לדיון — Pending orders that can be added to a procurement meeting agenda. Returns two groups: orders with pending payments (ממתין) and PIs awaiting payment approval (no payment schedule yet). Optionally excludes orders already on a specific meeting.",
    {
      meeting_id: z.string().uuid().optional().describe("Meeting UUID — if provided, orders already on this meeting's agenda are excluded"),
    },
    async ({ meeting_id }) => {
      // 1. Orders with at least one pending payment
      const { data: paymentsData } = await supabase
        .from("order_payments")
        .select("order_id, id, payment_type, amount, currency, due_date, status")
        .eq("status", "ממתין");

      const paymentsByOrder: Record<string, Record<string, unknown>[]> = {};
      for (const p of (paymentsData || []) as Record<string, unknown>[]) {
        const oid = p.order_id as string;
        if (!paymentsByOrder[oid]) paymentsByOrder[oid] = [];
        paymentsByOrder[oid].push(p);
      }
      const orderIdsWithPayments = Object.keys(paymentsByOrder);

      // 2. PIs awaiting approval (PENDING/ORDERED with pi_number, no payment rows)
      const { data: piData } = await supabase
        .from("orders")
        .select("id, supplier_name, pi_number, status, total_price, priority, eta, etd, notes")
        .not("pi_number", "is", null)
        .in("status", ["PENDING", "ORDERED"]);

      const piOrderIds = ((piData || []) as Record<string, unknown>[])
        .map(o => o.id as string)
        .filter(id => !orderIdsWithPayments.includes(id));

      // 3. Fetch full order data for group A
      let paymentOrders: Record<string, unknown>[] = [];
      if (orderIdsWithPayments.length > 0) {
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, supplier_name, pi_number, status, total_price, priority, eta, etd, notes")
          .in("id", orderIdsWithPayments)
          .not("status", "in", '("CANCELLED","ARRIVED","DELIVERED")');
        paymentOrders = (ordersData || []) as Record<string, unknown>[];
      }

      // 4. Exclude orders already on the meeting (if meeting_id provided)
      let excludedIds = new Set<string>();
      if (meeting_id) {
        const { data: alreadyAdded } = await supabase
          .from("procurement_meeting_orders")
          .select("order_id")
          .eq("meeting_id", meeting_id);
        excludedIds = new Set(((alreadyAdded || []) as Record<string, unknown>[]).map(r => r.order_id as string));
      }

      // 5. Build group A: payment pending
      const priorityOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };
      const groupA = paymentOrders
        .filter(o => !excludedIds.has(o.id as string))
        .map(o => {
          const payments = paymentsByOrder[o.id as string] || [];
          const totalPending = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          return {
            ...o,
            pending_payments: payments,
            total_pending_amount: totalPending,
            payment_currency: (payments[0] as Record<string, unknown>)?.currency ?? null,
          };
        })
        .sort((a, b) => (priorityOrder[(a as Record<string, unknown>).priority as string] ?? 9) - (priorityOrder[(b as Record<string, unknown>).priority as string] ?? 9));

      // 6. Build group B: PIs awaiting approval
      const piOrders = piData || [];
      const groupB = (piOrders as Record<string, unknown>[])
        .filter(o => piOrderIds.includes(o.id as string) && !excludedIds.has(o.id as string))
        .sort((a, b) => (priorityOrder[a.priority as string] ?? 9) - (priorityOrder[b.priority as string] ?? 9));

      // 7. Totals by currency for group A
      const totalByCurrency: Record<string, number> = {};
      for (const o of groupA) {
        const cur = (o.payment_currency as string) || "USD";
        totalByCurrency[cur] = (totalByCurrency[cur] || 0) + (Number(o.total_pending_amount) || 0);
      }

      const result = {
        summary: {
          payment_pending: groupA.length,
          pi_awaiting_approval: groupB.length,
          total: groupA.length + groupB.length,
          total_pending_by_currency: totalByCurrency,
          ...(meeting_id ? { excluded_already_on_meeting: excludedIds.size } : {}),
        },
        payment_pending: groupA,
        pi_awaiting_approval: groupB,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
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
