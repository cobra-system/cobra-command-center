import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

const ACTIVE_ORDER_STATUSES = ["PENDING", "ORDERED", "SHIPPED", "ARRIVED_PORT", "CUSTOMS_CLEARANCE"];

function calcUrgency(runwayDays: number, hasIncoming: boolean): "critical" | "high" | "medium" | "low" {
  if (runwayDays < 30 && !hasIncoming) return "critical";
  if (runwayDays < 60) return "high";
  if (runwayDays < 90) return "medium";
  return "low";
}

export function registerProcurementInventoryTools(server: McpServer) {
  // ── get_product_inventory_full ────────────────────────────────────────────
  server.tool(
    "get_product_inventory_full",
    "מלאי מלא למוצר — Full inventory snapshot for a product: stock by center, incoming orders, 6-month consumption, runway days, reorder recommendation. Use for procurement meetings.",
    {
      product_id: z.string().uuid().optional().describe("Product UUID"),
      sku:        z.string().optional().describe("Product SKU (e.g. 'm305') — alternative to product_id"),
    },
    async ({ product_id, sku }) => {
      if (!product_id && !sku) {
        return { content: [{ type: "text" as const, text: "Error: provide product_id or sku" }] };
      }

      // 1. Resolve product
      let productQuery = supabase.from("products").select("id, sku, name, supplier_id");
      if (product_id) productQuery = productQuery.eq("id", product_id);
      else             productQuery = productQuery.ilike("sku", sku!);

      const { data: products, error: productErr } = await productQuery.limit(1);
      if (productErr) return { content: [{ type: "text" as const, text: `Error: ${productErr.message}` }] };
      if (!products || products.length === 0) {
        return { content: [{ type: "text" as const, text: `Product not found: ${product_id ?? sku}` }] };
      }
      const product = products[0] as Record<string, unknown>;
      const pid = product.id as string;

      // 2. Parallel fetches
      const [inventoryRes, incomingRes, consumptionRes, supplierRes] = await Promise.all([
        // Stock by center
        supabase
          .from("center_inventory")
          .select("quantity, distribution_centers(id, name)")
          .eq("product_id", pid),

        // Incoming orders (active statuses)
        supabase
          .from("order_items")
          .select("qty, orders!inner(id, pi_number, eta, shipping, status, supplier_name)")
          .eq("product_id", pid)
          .in("orders.status", ACTIVE_ORDER_STATUSES),

        // Monthly consumption (last 6 months from equipment pickups)
        supabase
          .from("equipment_pickup_items")
          .select("quantity, equipment_pickups!inner(pickup_date)")
          .eq("product_id", pid)
          .gte("equipment_pickups.pickup_date", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()),

        // Supplier for display
        product.supplier_id
          ? supabase.from("suppliers").select("company").eq("id", product.supplier_id as string).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      // 3. Stock by center
      const stockByCenterRaw = (inventoryRes.data || []) as Record<string, unknown>[];
      const stockByCenter = stockByCenterRaw.map(row => {
        const dc = row.distribution_centers as Record<string, unknown>;
        return {
          center_id:   dc?.id ?? null,
          center_name: dc?.name ?? "Unknown",
          quantity:    Number(row.quantity) || 0,
        };
      });
      const totalStock = stockByCenter.reduce((s, c) => s + c.quantity, 0);

      // 4. Incoming orders
      const incomingRaw = (incomingRes.data || []) as Record<string, unknown>[];
      const incomingOrders = incomingRaw.map(row => {
        const order = row.orders as Record<string, unknown>;
        return {
          order_id:  order.id,
          pi_number: order.pi_number,
          qty:       Number(row.qty) || 0,
          eta:       order.eta,
          shipping:  order.shipping,
          status:    order.status,
        };
      });
      const totalIncoming = incomingOrders.reduce((s, o) => s + o.qty, 0);

      // 5. Monthly consumption — bucket by month
      const consumptionRaw = (consumptionRes.data || []) as Record<string, unknown>[];
      const byMonth: Record<string, number> = {};
      for (const row of consumptionRaw) {
        const pickup = row.equipment_pickups as Record<string, unknown>;
        const date = pickup?.pickup_date as string;
        if (!date) continue;
        const monthKey = date.slice(0, 7); // "YYYY-MM"
        byMonth[monthKey] = (byMonth[monthKey] || 0) + (Number(row.quantity) || 0);
      }
      const monthKeys = Object.keys(byMonth).sort();
      const last3 = monthKeys.slice(-3);
      const last6 = monthKeys.slice(-6);
      const avg3m = last3.length > 0 ? last3.reduce((s, m) => s + byMonth[m], 0) / last3.length : 0;
      const avg6m = last6.length > 0 ? last6.reduce((s, m) => s + byMonth[m], 0) / last6.length : 0;

      // 6. Runway = totalStock / (avg3m / 30) days
      const dailyRate = avg3m / 30;
      const runwayDays = dailyRate > 0 ? Math.round(totalStock / dailyRate) : 99999;
      const urgency = calcUrgency(runwayDays, totalIncoming > 0);

      // 7. Reorder suggestion
      const leadTimeDays = 90; // default sea lead time
      const bufferMonths = 3;
      const neededQty = Math.max(0, Math.round(avg3m * (bufferMonths + (leadTimeDays / 30)) - totalStock - totalIncoming));
      const reasoning = avg3m > 0
        ? `מלאי ${totalStock} + בדרך ${totalIncoming} = ${totalStock + totalIncoming} יח'. צריכה ${Math.round(avg3m)}/חודש = מספיק ל-${Math.round((totalStock + totalIncoming) / avg3m)} חודשים.`
        : "אין נתוני צריכה — לא ניתן לחשב המלצת הזמנה.";

      const result = {
        product: {
          id:       pid,
          sku:      product.sku,
          name:     product.name,
          supplier: (supplierRes.data as Record<string, unknown> | null)?.company ?? null,
        },
        stock_by_center: stockByCenter,
        total_stock:     totalStock,
        incoming_orders: incomingOrders,
        total_incoming:  totalIncoming,
        monthly_consumption: {
          avg_3m:   Math.round(avg3m * 10) / 10,
          avg_6m:   Math.round(avg6m * 10) / 10,
          by_month: monthKeys.map(m => ({ month: m, qty: byMonth[m] })),
        },
        runway_days: runwayDays,
        reorder: {
          needed_qty:  neededQty,
          urgency,
          reasoning,
        },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_reorder_dashboard ─────────────────────────────────────────────────
  server.tool(
    "get_reorder_dashboard",
    "לוח מחוונים הזמנות חוזרות — Cross-product reorder dashboard: runway, urgency, and suggested quantities for all products. Filter by category, supplier, or urgency.",
    {
      category:       z.string().optional().describe("Filter by product category"),
      supplier_id:    z.string().uuid().optional().describe("Filter by supplier UUID"),
      urgency_filter: z.enum(["critical", "high", "medium", "low"]).optional().describe("Show only products at this urgency level or higher"),
    },
    async ({ category, supplier_id, urgency_filter }) => {
      // 1. Load all products (with optional filters)
      let productQuery = supabase
        .from("products")
        .select("id, sku, name, supplier_id, category");
      if (category)    productQuery = productQuery.ilike("category", `%${category}%`);
      if (supplier_id) productQuery = productQuery.eq("supplier_id", supplier_id);

      const { data: products, error: productErr } = await productQuery.limit(500);
      if (productErr) return { content: [{ type: "text" as const, text: `Error: ${productErr.message}` }] };
      if (!products || products.length === 0) {
        return { content: [{ type: "text" as const, text: "No products found" }] };
      }

      const productIds = (products as Record<string, unknown>[]).map(p => p.id as string);

      // 2. Load stock, incoming orders, and consumption in parallel
      const [inventoryRes, incomingItemsRes, consumptionRes, supplierRes] = await Promise.all([
        supabase.from("center_inventory").select("product_id, quantity").in("product_id", productIds),

        supabase
          .from("order_items")
          .select("product_id, qty, orders!inner(status)")
          .in("product_id", productIds)
          .in("orders.status", ACTIVE_ORDER_STATUSES),

        supabase
          .from("equipment_pickup_items")
          .select("product_id, quantity, equipment_pickups!inner(pickup_date)")
          .in("product_id", productIds)
          .gte("equipment_pickups.pickup_date", new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString()),

        supabase.from("suppliers").select("id, company"),
      ]);

      // 3. Index data by product_id
      const stockByProduct: Record<string, number> = {};
      for (const row of (inventoryRes.data || []) as Record<string, unknown>[]) {
        const pid = row.product_id as string;
        stockByProduct[pid] = (stockByProduct[pid] || 0) + (Number(row.quantity) || 0);
      }

      const incomingByProduct: Record<string, number> = {};
      for (const row of (incomingItemsRes.data || []) as Record<string, unknown>[]) {
        const pid = row.product_id as string;
        incomingByProduct[pid] = (incomingByProduct[pid] || 0) + (Number(row.qty) || 0);
      }

      const consumptionByProduct: Record<string, number[]> = {};
      for (const row of (consumptionRes.data || []) as Record<string, unknown>[]) {
        const pid = row.product_id as string;
        if (!consumptionByProduct[pid]) consumptionByProduct[pid] = [];
        consumptionByProduct[pid].push(Number(row.quantity) || 0);
      }

      const supplierMap: Record<string, string> = {};
      for (const s of (supplierRes.data || []) as Record<string, unknown>[]) {
        supplierMap[s.id as string] = s.company as string;
      }

      // 4. Build dashboard rows
      const URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
      const filterLevel = urgency_filter ? URGENCY_ORDER[urgency_filter] : 3;

      const rows: Record<string, unknown>[] = [];

      for (const p of products as Record<string, unknown>[]) {
        const pid = p.id as string;
        const totalStock    = stockByProduct[pid] || 0;
        const totalIncoming = incomingByProduct[pid] || 0;
        const consumption   = consumptionByProduct[pid] || [];
        const avg3m         = consumption.length > 0
          ? consumption.reduce((s, v) => s + v, 0) / 3
          : 0;

        const dailyRate  = avg3m / 30;
        const runwayDays = dailyRate > 0 ? Math.round(totalStock / dailyRate) : 99999;
        const urgency    = calcUrgency(runwayDays, totalIncoming > 0);

        if (URGENCY_ORDER[urgency] > filterLevel) continue;

        const neededQty = avg3m > 0
          ? Math.max(0, Math.round(avg3m * 6 - totalStock - totalIncoming))
          : 0;

        rows.push({
          product_id:          pid,
          sku:                 p.sku,
          name:                p.name,
          supplier:            supplierMap[p.supplier_id as string] ?? null,
          total_stock:         totalStock,
          total_incoming:      totalIncoming,
          monthly_consumption: Math.round(avg3m * 10) / 10,
          runway_days:         runwayDays === 99999 ? null : runwayDays,
          needed_qty:          neededQty,
          urgency,
          suggested_shipping:  neededQty > 0 && runwayDays < 45 ? "אוויר" : "ים",
        });
      }

      rows.sort((a, b) =>
        (URGENCY_ORDER[a.urgency as keyof typeof URGENCY_ORDER] ?? 9) -
        (URGENCY_ORDER[b.urgency as keyof typeof URGENCY_ORDER] ?? 9)
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ total: rows.length, rows }, null, 2),
        }],
      };
    }
  );

  // ── import_stock_snapshot ─────────────────────────────────────────────────
  server.tool(
    "import_stock_snapshot",
    "ייבוא מלאי — Import a stock snapshot from SAP or any external source. UPSERTs quantities into center_inventory by SKU + center name.",
    {
      items: z.array(z.object({
        sku:         z.string().describe("Product SKU"),
        center_name: z.string().describe("Distribution center name (e.g. 'תל אביב', 'קרסו')"),
        quantity:    z.number().min(0).describe("Stock quantity"),
      })).describe("Array of SKU + center + quantity rows"),
    },
    async ({ items }) => {
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Pre-load all products and centers to avoid N+1 queries
      const skus = [...new Set(items.map(i => i.sku.toLowerCase()))];
      const centerNames = [...new Set(items.map(i => i.center_name))];

      const [productsRes, centersRes] = await Promise.all([
        supabase.from("products").select("id, sku").in("sku", skus),
        supabase.from("distribution_centers").select("id, name").in("name", centerNames),
      ]);

      const productMap: Record<string, string> = {};
      for (const p of (productsRes.data || []) as Record<string, unknown>[]) {
        productMap[(p.sku as string).toLowerCase()] = p.id as string;
      }

      const centerMap: Record<string, string> = {};
      for (const c of (centersRes.data || []) as Record<string, unknown>[]) {
        centerMap[(c.name as string).toLowerCase()] = c.id as string;
      }

      for (const item of items) {
        const productId = productMap[item.sku.toLowerCase()];
        const centerId  = centerMap[item.center_name.toLowerCase()];

        if (!productId) {
          errors.push(`SKU not found: ${item.sku}`);
          skipped++;
          continue;
        }
        if (!centerId) {
          errors.push(`Center not found: ${item.center_name}`);
          skipped++;
          continue;
        }

        // Check for existing record
        const { data: existing } = await supabase
          .from("center_inventory")
          .select("id")
          .eq("product_id", productId)
          .eq("center_id", centerId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("center_inventory")
            .update({ quantity: item.quantity })
            .eq("id", (existing as Record<string, unknown>).id as string);
          if (error) { errors.push(`Update error ${item.sku}@${item.center_name}: ${error.message}`); skipped++; }
          else updated++;
        } else {
          const { error } = await supabase
            .from("center_inventory")
            .insert({ product_id: productId, center_id: centerId, quantity: item.quantity });
          if (error) { errors.push(`Insert error ${item.sku}@${item.center_name}: ${error.message}`); skipped++; }
          else updated++;
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ updated, skipped, errors }, null, 2),
        }],
      };
    }
  );

  // ── get_supplier_bank_details ─────────────────────────────────────────────
  server.tool(
    "get_supplier_bank_details",
    "פרטי בנק של ספק — Get wire transfer bank details for a supplier",
    {
      supplier_id: z.string().uuid().describe("Supplier UUID"),
    },
    async ({ supplier_id }) => {
      const { data, error } = await supabase
        .from("supplier_bank_details")
        .select("*")
        .eq("supplier_id", supplier_id)
        .order("created_at", { ascending: false });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      if (!data || data.length === 0) {
        return { content: [{ type: "text" as const, text: `No bank details found for supplier ${supplier_id}` }] };
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── sync_email_to_order ───────────────────────────────────────────────────
  server.tool(
    "sync_email_to_order",
    "סנכרון אימייל להזמנה — Append shipping/tracking info from an email to an order. Smart-appends to notes without overwriting existing content.",
    {
      order_id:         z.string().uuid().describe("Order UUID"),
      tracking_number:  z.string().optional().describe("Tracking or container number"),
      eta:              z.string().optional().describe("Updated ETA (YYYY-MM-DD)"),
      vessel_name:      z.string().optional().describe("Vessel name"),
      tclog_reference:  z.string().optional().describe("tclog reference number"),
      booking_number:   z.string().optional().describe("Booking / BL number"),
      email_summary:    z.string().optional().describe("Short summary of the email content to append to notes"),
    },
    async ({ order_id, tracking_number, eta, vessel_name, tclog_reference, booking_number, email_summary }) => {
      // Fetch current order
      const { data: order, error: fetchErr } = await supabase
        .from("orders")
        .select("notes, tracking_number, eta, vessel_name, tclog_reference, booking_number")
        .eq("id", order_id)
        .single();

      if (fetchErr) return { content: [{ type: "text" as const, text: `Error: ${fetchErr.message}` }] };

      const o = order as Record<string, unknown>;
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (tracking_number) updates.tracking_number = tracking_number;
      if (eta)             updates.eta             = eta;
      if (vessel_name)     updates.vessel_name     = vessel_name;
      if (tclog_reference) updates.tclog_reference = tclog_reference;
      if (booking_number)  updates.booking_number  = booking_number;

      // Smart-append notes
      if (email_summary) {
        const dateStr = new Date().toLocaleDateString("he-IL");
        const appendLine = `[${dateStr}] ${email_summary}`;
        const currentNotes = (o.notes as string) || "";

        // Save old notes to history before overwriting
        await supabase.from("order_notes_history").insert({
          order_id,
          note_text:     currentNotes,
          changed_at:    new Date().toISOString(),
          change_reason: "sync_email_to_order",
        });

        updates.notes = currentNotes ? `${currentNotes}\n${appendLine}` : appendLine;
      }

      if (Object.keys(updates).length === 1) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }

      const { data: updated, error: updateErr } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", order_id)
        .select()
        .single();

      if (updateErr) return { content: [{ type: "text" as const, text: `Error: ${updateErr.message}` }] };
      return { content: [{ type: "text" as const, text: `Order synced:\n${JSON.stringify(updated, null, 2)}` }] };
    }
  );

  // ── get_order_timeline ────────────────────────────────────────────────────
  server.tool(
    "get_order_timeline",
    "ציר זמן הזמנה — Full timeline of events for an order: creation, payments, meetings, documents, notes history — merged and sorted by date.",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      const [orderRes, paymentsRes, notesRes, meetingsRes, docsRes] = await Promise.all([
        supabase.from("orders").select("created_at, pi_number, status, supplier_name, order_date").eq("id", order_id).single(),
        supabase.from("order_payments").select("payment_type, amount, currency, status, due_date, created_at").eq("order_id", order_id).order("created_at"),
        supabase.from("order_notes_history").select("note_text, changed_at, change_reason").eq("order_id", order_id).order("changed_at"),
        supabase
          .from("procurement_meeting_orders")
          .select("decision, approved_amount, notes, created_at, updated_at, meetings!inner(title, meeting_date)")
          .eq("order_id", order_id),
        supabase.from("purchase_documents").select("document_name, type, created_at").eq("order_id", order_id).order("created_at"),
      ]);

      const events: { date: string; event: string; details: string }[] = [];

      // Order creation
      if (orderRes.data) {
        const o = orderRes.data as Record<string, unknown>;
        events.push({
          date:    (o.order_date ?? o.created_at) as string,
          event:   "נוצרה הזמנה",
          details: `${o.supplier_name}${o.pi_number ? ` — PI ${o.pi_number}` : ""}`,
        });
      }

      // Payments
      for (const p of (paymentsRes.data || []) as Record<string, unknown>[]) {
        const isPaid = p.status === "שולם";
        events.push({
          date:    (p.due_date ?? p.created_at) as string,
          event:   isPaid ? `שולם ${p.payment_type}` : `מתוזמן ${p.payment_type}`,
          details: `$${Number(p.amount).toLocaleString()} ${p.currency ?? "USD"}${p.status !== "שולם" ? " — ממתין" : ""}`,
        });
      }

      // Notes history
      for (const n of (notesRes.data || []) as Record<string, unknown>[]) {
        const reason = n.change_reason ? ` (${n.change_reason})` : "";
        events.push({
          date:    n.changed_at as string,
          event:   `עדכון הערות${reason}`,
          details: String(n.note_text || "").slice(0, 120),
        });
      }

      // Procurement meetings
      for (const m of (meetingsRes.data || []) as Record<string, unknown>[]) {
        const meeting = m.meetings as Record<string, unknown>;
        const decisionLabel = m.decision === "approved" ? "אושר"
          : m.decision === "deferred" ? "נדחה"
          : m.decision === "partial"  ? "אושר חלקי"
          : "ממתין";
        events.push({
          date:    (meeting?.meeting_date ?? m.updated_at) as string,
          event:   `ישיבת רכש — ${meeting?.title}`,
          details: `${decisionLabel}${m.approved_amount ? ` — $${Number(m.approved_amount).toLocaleString()}` : ""}${m.notes ? ` — ${m.notes}` : ""}`,
        });
      }

      // Documents
      for (const d of (docsRes.data || []) as Record<string, unknown>[]) {
        events.push({
          date:    d.created_at as string,
          event:   `מסמך: ${d.type}`,
          details: d.document_name as string,
        });
      }

      // Sort by date
      events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ order_id, events }, null, 2),
        }],
      };
    }
  );
}
