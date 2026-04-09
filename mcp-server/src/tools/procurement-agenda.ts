import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerProcurementAgendaTools(server: McpServer) {
  server.tool(
    "get_procurement_meeting_agenda",
    "אג'נדה לישיבת רכש — Generate a meeting agenda for pending payments and order decisions",
    {
      days_ahead: z.number().default(30).describe("Include payments due within this many days"),
      include_overdue: z.boolean().default(true).describe("Include overdue payments"),
      currency: z.enum(["USD", "EUR", "ILS", "all"]).default("all").describe("Filter by currency"),
    },
    async ({ days_ahead, include_overdue, currency }) => {
      const today = new Date().toISOString().split("T")[0];
      const futureDate = new Date(Date.now() + days_ahead * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Fetch pending order_payments with their orders
      let query = supabase
        .from("order_payments")
        .select(`
          id,
          order_id,
          payment_type,
          amount,
          currency,
          percentage,
          due_date,
          paid_date,
          swift_reference,
          status,
          notes,
          orders!inner(
            id,
            supplier_name,
            pi_number,
            status,
            total_price,
            eta,
            etd,
            vessel_name,
            shipment_group_id
          )
        `)
        .eq("status", "ממתין")
        .is("paid_date", null);

      if (currency !== "all") {
        query = query.eq("currency", currency);
      }

      const { data: payments, error } = await query;

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const allPayments = (payments || []) as Record<string, unknown>[];

      // Categorize by urgency
      const overdue: typeof allPayments = [];
      const dueThisWeek: typeof allPayments = [];
      const dueThisMonth: typeof allPayments = [];
      const futureDue: typeof allPayments = [];
      const noDueDate: typeof allPayments = [];

      for (const p of allPayments) {
        const dueDate = p.due_date as string | null;
        if (!dueDate) {
          noDueDate.push(p);
        } else if (dueDate < today) {
          if (include_overdue) overdue.push(p);
        } else if (dueDate <= weekFromNow) {
          dueThisWeek.push(p);
        } else if (dueDate <= futureDate) {
          dueThisMonth.push(p);
        } else {
          futureDue.push(p);
        }
      }

      // Currency totals for each category
      const sumByCurrency = (items: typeof allPayments) => {
        const totals: Record<string, number> = {};
        for (const p of items) {
          const cur = (p.currency as string) || "USD";
          totals[cur] = (totals[cur] || 0) + (Number(p.amount) || 0);
        }
        return totals;
      };

      const formatPayment = (p: Record<string, unknown>) => {
        const order = p.orders as Record<string, unknown>;
        const daysUntilDue = p.due_date
          ? Math.ceil(
              (new Date(p.due_date as string).getTime() - new Date(today).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;
        return {
          payment_id: p.id,
          order_id: p.order_id,
          supplier: order?.supplier_name,
          pi_number: order?.pi_number,
          order_status: order?.status,
          vessel: order?.vessel_name,
          payment_type: p.payment_type,
          amount: p.amount,
          currency: p.currency,
          percentage: p.percentage,
          due_date: p.due_date,
          days_until_due: daysUntilDue,
          swift_reference: p.swift_reference,
          notes: p.notes,
        };
      };

      // Fetch supplementary data in parallel
      const [etaAlertsRes, customsOrdersRes, pendingPiOrdersRes] = await Promise.all([
        // ETA alerts: shipped orders whose ETA has passed
        supabase
          .from("orders")
          .select("id, supplier_name, status, eta, pi_number, vessel_name, total_price")
          .in("status", ["ORDERED", "SHIPPED"])
          .lt("eta", today),
        // Orders awaiting customs
        supabase
          .from("orders")
          .select("id, supplier_name, status, eta, pi_number, vessel_name, total_price")
          .in("status", ["ARRIVED_PORT", "CUSTOMS_CLEARANCE"]),
        // Orders with PI but NO Deposit payment in order_payments yet
        // = PIs received from supplier, not yet approved/paid
        supabase
          .from("orders")
          .select("id, supplier_name, status, total_price, pi_number, etd, vessel_name, created_at")
          .not("pi_number", "is", null)
          .in("status", ["PENDING", "ORDERED"]),
      ]);

      const etaAlerts = etaAlertsRes.data || [];
      const customsOrders = customsOrdersRes.data || [];
      const pendingPiCandidates = pendingPiOrdersRes.data || [];

      // From the pending-PI candidates, keep only those with NO order_payments row at all
      // (no deposit scheduled means PI hasn't been approved for payment yet)
      let pisPendingApproval: typeof pendingPiCandidates = [];
      if (pendingPiCandidates.length > 0) {
        const candidateIds = pendingPiCandidates.map((o: Record<string, unknown>) => o.id as string);
        const { data: existingPayments } = await supabase
          .from("order_payments")
          .select("order_id")
          .in("order_id", candidateIds);
        const ordersWithPayments = new Set(
          (existingPayments || []).map((p: Record<string, unknown>) => p.order_id as string)
        );
        pisPendingApproval = pendingPiCandidates.filter(
          (o: Record<string, unknown>) => !ordersWithPayments.has(o.id as string)
        );
      }

      const agenda = {
        generated_at: new Date().toISOString(),
        meeting_date: today,
        summary: {
          total_pending_payments: allPayments.length,
          overdue: overdue.length,
          due_this_week: dueThisWeek.length,
          due_this_month: dueThisMonth.length,
          pis_awaiting_approval: pisPendingApproval.length,
          total_by_currency: sumByCurrency(allPayments),
          overdue_by_currency: sumByCurrency(overdue),
          due_this_week_by_currency: sumByCurrency(dueThisWeek),
        },
        agenda_items: {
          "0_pis_awaiting_approval": {
            title: "📋 PIs חדשים ממתינים לאישור — New PIs Awaiting Payment Decision",
            count: pisPendingApproval.length,
            description: "Orders with a PI number but no payment schedule set yet — need decision: approve and set deposit due date, or hold",
            items: pisPendingApproval,
          },
          "1_overdue_payments": {
            title: "🔴 תשלומים באיחור — Overdue Payments",
            count: overdue.length,
            total_by_currency: sumByCurrency(overdue),
            items: overdue.map(formatPayment),
          },
          "2_due_this_week": {
            title: "🟡 תשלומים השבוע — Due This Week",
            count: dueThisWeek.length,
            total_by_currency: sumByCurrency(dueThisWeek),
            items: dueThisWeek.map(formatPayment),
          },
          "3_due_this_month": {
            title: `🟢 תשלומים בחודש הקרוב — Due Within ${days_ahead} Days`,
            count: dueThisMonth.length,
            total_by_currency: sumByCurrency(dueThisMonth),
            items: dueThisMonth.map(formatPayment),
          },
          "4_no_due_date": {
            title: "⚪ ללא תאריך יעד — No Due Date Set",
            count: noDueDate.length,
            items: noDueDate.map(formatPayment),
          },
          "5_eta_alerts": {
            title: "⚠️ הזמנות עם ETA שעבר — Orders with Overdue ETA",
            count: etaAlerts.length,
            description: "These orders are still ORDERED/SHIPPED but ETA has passed — need status update",
            items: etaAlerts,
          },
          "6_customs_clearance": {
            title: "🛃 בתהליך שחרור מכס — Orders in Customs",
            count: customsOrders.length,
            items: customsOrders,
          },
        },
      };

      // Generate markdown summary for easy copy-paste into meeting notes
      const markdownLines: string[] = [
        `# ישיבת רכש — ${today}`,
        "",
        "## סיכום תשלומים ממתינים",
        "",
      ];

      if (pisPendingApproval.length > 0) {
        markdownLines.push(`### 📋 PIs ממתינים לאישור (${pisPendingApproval.length})`);
        for (const o of pisPendingApproval as Record<string, unknown>[]) {
          markdownLines.push(`- **${o.supplier_name}** | PI: ${o.pi_number} | ${o.total_price ? `$${o.total_price}` : "—"} | Status: ${o.status}`);
        }
        markdownLines.push("");
      }

      if (overdue.length > 0) {
        markdownLines.push(`### 🔴 באיחור (${overdue.length} תשלומים)`);
        for (const p of overdue.map(formatPayment)) {
          markdownLines.push(`- **${p.supplier}** | PI: ${p.pi_number || "—"} | ${p.payment_type} | ${p.amount} ${p.currency} | Due: ${p.due_date}`);
        }
        markdownLines.push("");
      }

      if (dueThisWeek.length > 0) {
        markdownLines.push(`### 🟡 השבוע (${dueThisWeek.length} תשלומים)`);
        for (const p of dueThisWeek.map(formatPayment)) {
          markdownLines.push(`- **${p.supplier}** | PI: ${p.pi_number || "—"} | ${p.payment_type} | ${p.amount} ${p.currency} | Due: ${p.due_date}`);
        }
        markdownLines.push("");
      }

      if (dueThisMonth.length > 0) {
        markdownLines.push(`### 🟢 החודש (${dueThisMonth.length} תשלומים)`);
        for (const p of dueThisMonth.map(formatPayment)) {
          markdownLines.push(`- **${p.supplier}** | PI: ${p.pi_number || "—"} | ${p.payment_type} | ${p.amount} ${p.currency} | Due: ${p.due_date}`);
        }
        markdownLines.push("");
      }

      const grandTotals = sumByCurrency(allPayments);
      if (Object.keys(grandTotals).length > 0) {
        markdownLines.push("### סה\"כ לתשלום");
        for (const [cur, total] of Object.entries(grandTotals)) {
          markdownLines.push(`- **${cur}**: ${total.toLocaleString()}`);
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ...agenda, markdown_summary: markdownLines.join("\n") }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "get_all_pending_payments_summary",
    "סיכום כל התשלומים הממתינים — Quick summary of all pending order payments grouped by supplier",
    {
      currency: z.enum(["USD", "EUR", "ILS", "all"]).default("all").describe("Filter by currency"),
    },
    async ({ currency }) => {
      let query = supabase
        .from("order_payments")
        .select(`
          id, order_id, payment_type, amount, currency, due_date, status,
          orders!inner(supplier_name, pi_number, status)
        `)
        .eq("status", "ממתין")
        .is("paid_date", null);

      if (currency !== "all") {
        query = query.eq("currency", currency);
      }

      const { data: payments, error } = await query;

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // Group by supplier
      const bySupplier: Record<string, { supplier: string; payments: unknown[]; total_by_currency: Record<string, number> }> = {};

      for (const p of (payments || []) as Record<string, unknown>[]) {
        const order = p.orders as Record<string, unknown>;
        const supplierName = (order?.supplier_name as string) || "Unknown";

        if (!bySupplier[supplierName]) {
          bySupplier[supplierName] = { supplier: supplierName, payments: [], total_by_currency: {} };
        }

        bySupplier[supplierName].payments.push({
          payment_id: p.id,
          order_id: p.order_id,
          pi_number: order?.pi_number,
          payment_type: p.payment_type,
          amount: p.amount,
          currency: p.currency,
          due_date: p.due_date,
        });

        const cur = (p.currency as string) || "USD";
        bySupplier[supplierName].total_by_currency[cur] =
          (bySupplier[supplierName].total_by_currency[cur] || 0) + (Number(p.amount) || 0);
      }

      const grandTotal: Record<string, number> = {};
      for (const sup of Object.values(bySupplier)) {
        for (const [cur, total] of Object.entries(sup.total_by_currency)) {
          grandTotal[cur] = (grandTotal[cur] || 0) + total;
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            by_supplier: Object.values(bySupplier),
            grand_total: grandTotal,
            total_payments: (payments || []).length,
          }, null, 2),
        }],
      };
    }
  );
}
