import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerDivisionTools(server: McpServer) {
  // ═══════════════════════════════════════════════════════════════
  // Division Products — מוצרי חטיבה
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_division_products",
    "מוצרי חטיבה — List division product intelligence records (field stock, quarterly demand). Filter by division or product_id.",
    {
      division: z.string().optional().describe("Filter by division: 'AWACS' | 'כפתור' | 'DOORE' | 'דלק מוטורס' | 'פריזבי קרסו' | 'לובינסקי'"),
      product_id: z.string().uuid().optional().describe("Filter by product UUID"),
    },
    async ({ division, product_id }) => {
      let query = supabase
        .from("division_products")
        .select(`
          id, division, product_id, division_stock, division_stock_updated_at,
          quarterly_demand, quarterly_demand_updated_at, notes, created_at, updated_at,
          products(id, name, sku)
        `)
        .order("division")
        .order("created_at");

      if (division) query = query.eq("division", division);
      if (product_id) query = query.eq("product_id", product_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "upsert_division_product",
    "עדכון מוצר חטיבה — Create or update a product entry for a division. Updates division_stock, quarterly_demand, and/or notes.",
    {
      division: z.string().describe("Division name: 'AWACS' | 'כפתור' | 'DOORE' | 'דלק מוטורס' | 'פריזבי קרסו' | 'לובינסקי'"),
      product_id: z.string().uuid().describe("Product UUID"),
      division_stock: z.number().int().min(0).optional().describe("Current field stock quantity"),
      quarterly_demand: z.number().int().min(0).optional().describe("Quarterly demand forecast"),
      notes: z.string().optional().describe("Free-text notes"),
    },
    async ({ division, product_id, division_stock, quarterly_demand, notes }) => {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        division,
        product_id,
        updated_at: now,
      };
      if (division_stock !== undefined) {
        payload.division_stock = division_stock;
        payload.division_stock_updated_at = now;
      }
      if (quarterly_demand !== undefined) {
        payload.quarterly_demand = quarterly_demand;
        payload.quarterly_demand_updated_at = now;
      }
      if (notes !== undefined) payload.notes = notes;

      const { data, error } = await supabase
        .from("division_products")
        .upsert(payload, { onConflict: "division,product_id" })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_division_product",
    "מחיקת מוצר חטיבה — Remove a product from division tracking by id.",
    {
      id: z.string().uuid().describe("division_products record UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("division_products")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: id }) }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Division Manager Assignment — שיוך מנהל חטיבה
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // Order Requests — בקשות הזמנה
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_order_requests",
    "בקשות הזמנה — List order requests from bonded division managers. Filter by division or status.",
    {
      division: z.string().optional().describe("Filter by division name"),
      status: z.enum(["pending", "ordered", "rejected", "cancelled"]).optional().describe("Filter by status"),
      include_history: z.boolean().optional().describe("If true, include audit history per request"),
    },
    async ({ division, status, include_history }) => {
      let query = supabase
        .from("order_requests")
        .select(include_history
          ? "*, order_request_history(*)"
          : "*"
        )
        .order("created_at", { ascending: false });

      if (division) query = query.eq("division", division);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_order_request",
    "יצירת בקשת הזמנה — Create a new order request / planning row for a bonded division.",
    {
      division: z.string().describe("Division name: 'דלק מוטורס' | 'פריזבי קרסו' | 'לובינסקי'"),
      product_id: z.string().uuid().optional().describe("Product UUID (optional)"),
      product_name: z.string().describe("Product name (displayed in request)"),
      product_sku: z.string().optional().describe("Product SKU / מק\"ט"),
      supplier: z.string().optional().describe("Supplier name"),
      quantity: z.number().nonnegative().optional().describe("Requested quantity (optional for planning rows)"),
      urgency: z.enum(["דחוף", "רגיל", "נמוך"]).optional().describe("Request urgency (default: רגיל)"),
      order_type: z.enum(["מיידית", "חודשית", "רבעונית", "חצי שנתית"]).optional().describe("Order frequency type (default: חודשית)"),
      current_consumption: z.string().optional(),
      reason: z.string().optional(),
      // Excel planning columns
      main_warehouse_stock: z.number().optional().describe("מלאי תקין מחסן 1"),
      division_stock: z.number().optional().describe("כמות מלאי תקין בפועל בחטיבה"),
      quarterly_forecast: z.number().optional().describe("צפי רבעון"),
      utilization_pct: z.number().optional().describe("% מימוש (fraction 0–1 or whole percent)"),
      incoming_orders: z.number().optional().describe('עול"ב'),
      smoothed_required: z.number().optional().describe("נדרש משוכלל (כולל מלאי ביטחון)"),
      required_to_order: z.number().optional().describe("נדרש להזמין"),
      incoming_arrival_date: z.string().optional().describe('תאריך הגעת עול"ב (YYYY-MM-DD)'),
      order_execution_date: z.string().optional().describe("תאריך ביצוע הזמנה (YYYY-MM-DD)"),
      payment_status: z.string().optional().describe("סטאטוס תשלום"),
      actual_ordered_qty: z.number().optional().describe("כמות שהוזמנה בפועל"),
      shipping_type: z.string().optional().describe("סוג משלוח"),
      estimated_arrival_date: z.string().optional().describe("תאריך הגעה משוער (YYYY-MM-DD)"),
      notes: z.string().optional().describe("הערות"),
    },
    async (args) => {
      const { data, error } = await supabase
        .from("order_requests")
        .insert({
          division: args.division,
          product_id: args.product_id ?? null,
          product_name: args.product_name,
          product_sku: args.product_sku ?? null,
          supplier: args.supplier ?? null,
          quantity: args.quantity ?? null,
          urgency: args.urgency ?? "רגיל",
          order_type: args.order_type ?? "חודשית",
          current_consumption: args.current_consumption ?? null,
          reason: args.reason ?? null,
          main_warehouse_stock: args.main_warehouse_stock ?? null,
          division_stock: args.division_stock ?? null,
          quarterly_forecast: args.quarterly_forecast ?? null,
          utilization_pct: args.utilization_pct ?? null,
          incoming_orders: args.incoming_orders ?? null,
          smoothed_required: args.smoothed_required ?? null,
          required_to_order: args.required_to_order ?? null,
          incoming_arrival_date: args.incoming_arrival_date ?? null,
          order_execution_date: args.order_execution_date ?? null,
          payment_status: args.payment_status ?? null,
          actual_ordered_qty: args.actual_ordered_qty ?? null,
          shipping_type: args.shipping_type ?? null,
          estimated_arrival_date: args.estimated_arrival_date ?? null,
          notes: args.notes ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_order_request",
    "עדכון בקשת הזמנה — Update any field on an order request / planning row. Pass only the fields you want to change.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
      product_name: z.string().optional(),
      product_sku: z.string().optional(),
      product_id: z.string().uuid().nullable().optional(),
      supplier: z.string().nullable().optional(),
      supplier_id: z.string().uuid().nullable().optional(),
      quantity: z.number().nonnegative().nullable().optional(),
      urgency: z.enum(["דחוף", "רגיל", "נמוך"]).optional(),
      order_type: z.enum(["מיידית", "חודשית", "רבעונית", "חצי שנתית"]).optional(),
      current_consumption: z.string().nullable().optional(),
      reason: z.string().nullable().optional(),
      estimated_unit_price: z.number().nullable().optional(),
      main_warehouse_stock: z.number().nullable().optional(),
      division_stock: z.number().nullable().optional(),
      quarterly_forecast: z.number().nullable().optional(),
      utilization_pct: z.number().nullable().optional(),
      incoming_orders: z.number().nullable().optional(),
      smoothed_required: z.number().nullable().optional(),
      required_to_order: z.number().nullable().optional(),
      incoming_arrival_date: z.string().nullable().optional(),
      order_execution_date: z.string().nullable().optional(),
      payment_status: z.string().nullable().optional(),
      actual_ordered_qty: z.number().nullable().optional(),
      shipping_type: z.string().nullable().optional(),
      estimated_arrival_date: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    },
    async ({ request_id, ...rest }) => {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) payload[k] = v;
      if (Object.keys(payload).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update." }] };
      }
      const { data, error } = await supabase
        .from("order_requests")
        .update(payload)
        .eq("id", request_id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_order_request",
    "מחיקת בקשת הזמנה — Delete a planning row / order request by id.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
    },
    async ({ request_id }) => {
      const { error } = await supabase
        .from("order_requests")
        .delete()
        .eq("id", request_id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: request_id }) }] };
    }
  );

  server.tool(
    "reject_order_request",
    "דחיית בקשת הזמנה — Mark an order request as rejected with a reason.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
      reject_reason: z.string().describe("Why this request is being declined"),
      reviewed_by_name: z.string().optional().describe("Name of the reviewer"),
    },
    async ({ request_id, reject_reason, reviewed_by_name }) => {
      const { data, error } = await supabase
        .from("order_requests")
        .update({
          status: "rejected",
          reject_reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by_name: reviewed_by_name ?? null,
        })
        .eq("id", request_id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "revert_order_request",
    "החזרת בקשת הזמנה ל-pending — Revert a fulfilled / rejected / cancelled request back to pending.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
    },
    async ({ request_id }) => {
      const { data, error } = await supabase
        .from("order_requests")
        .update({
          status: "pending",
          order_id: null,
          ordered_at: null,
          ordered_by: null,
          ordered_by_name: null,
          reject_reason: null,
          reviewed_at: null,
          reviewed_by: null,
          reviewed_by_name: null,
          actual_ordered_qty: null,
        })
        .eq("id", request_id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "bulk_update_order_requests",
    "עדכון בקשות מרובה — Update multiple order requests at once with the same fields. Useful for bulk planning updates.",
    {
      request_ids: z.array(z.string().uuid()).min(1).describe("Array of order request UUIDs"),
      patch: z.object({
        urgency: z.enum(["דחוף", "רגיל", "נמוך"]).optional(),
        order_type: z.enum(["מיידית", "חודשית", "רבעונית", "חצי שנתית"]).optional(),
        status: z.enum(["pending", "ordered", "rejected", "cancelled"]).optional(),
        payment_status: z.string().nullable().optional(),
        shipping_type: z.string().nullable().optional(),
        order_execution_date: z.string().nullable().optional(),
        estimated_arrival_date: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }).describe("Common fields to apply to every request"),
    },
    async ({ request_ids, patch }) => {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) payload[k] = v;
      if (Object.keys(payload).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update." }] };
      }
      const { data, error } = await supabase
        .from("order_requests")
        .update(payload)
        .in("id", request_ids)
        .select("id, status, urgency, order_type, payment_status, notes");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: data?.length ?? 0, rows: data }, null, 2) }] };
    }
  );

  server.tool(
    "list_order_request_history",
    "היסטוריית בקשת הזמנה — Audit trail for one order request.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
    },
    async ({ request_id }) => {
      const { data, error } = await supabase
        .from("order_request_history")
        .select("*")
        .eq("request_id", request_id)
        .order("changed_at", { ascending: false });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_order_request_comments",
    "תגובות בבקשת הזמנה — Discussion thread for one request.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
    },
    async ({ request_id }) => {
      const { data, error } = await supabase
        .from("order_request_comments")
        .select("*")
        .eq("request_id", request_id)
        .order("created_at", { ascending: false });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "add_order_request_comment",
    "הוספת תגובה לבקשת הזמנה — Post a comment on a request thread.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
      body: z.string().min(1).describe("Comment text"),
      created_by_name: z.string().optional(),
      created_by_role: z.string().optional(),
    },
    async ({ request_id, body, created_by_name, created_by_role }) => {
      const { data, error } = await supabase
        .from("order_request_comments")
        .insert({
          request_id,
          body,
          created_by_name: created_by_name ?? null,
          created_by_role: created_by_role ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_order_request_comment",
    "מחיקת תגובה — Delete a comment by id.",
    {
      comment_id: z.string().uuid().describe("Comment UUID"),
    },
    async ({ comment_id }) => {
      const { error } = await supabase
        .from("order_request_comments")
        .delete()
        .eq("id", comment_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: comment_id }) }] };
    }
  );

  server.tool(
    "list_order_request_attachments",
    "קבצים מצורפים — List attachments for one request.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
    },
    async ({ request_id }) => {
      const { data, error } = await supabase
        .from("order_request_attachments")
        .select("*")
        .eq("request_id", request_id)
        .order("created_at", { ascending: false });
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "add_order_request_attachment",
    "הוספת קובץ מצורף — Attach a file (URL) to a request.",
    {
      request_id: z.string().uuid(),
      file_name: z.string().min(1),
      file_url: z.string().url(),
      file_type: z.string().optional(),
      file_size: z.number().optional(),
      description: z.string().optional(),
      created_by_name: z.string().optional(),
    },
    async ({ request_id, file_name, file_url, file_type, file_size, description, created_by_name }) => {
      const { data, error } = await supabase
        .from("order_request_attachments")
        .insert({ request_id, file_name, file_url, file_type, file_size, description, created_by_name: created_by_name ?? null })
        .select()
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_order_request_attachment",
    "מחיקת קובץ — Delete an attachment by id.",
    {
      attachment_id: z.string().uuid(),
    },
    async ({ attachment_id }) => {
      const { error } = await supabase
        .from("order_request_attachments")
        .delete()
        .eq("id", attachment_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: attachment_id }) }] };
    }
  );

  server.tool(
    "capture_order_request_snapshot",
    "צילום מצב בקשות — Capture the current planning state into a snapshot (e.g. quarterly closing).",
    {
      label: z.string().min(1).describe('Snapshot label, e.g. "סגירת Q1 2026"'),
      division: z.string().optional().describe("Optional: limit snapshot to a single division"),
      notes: z.string().optional(),
    },
    async ({ label, division, notes }) => {
      const { data, error } = await supabase.rpc("capture_order_request_snapshot", {
        p_label: label,
        p_division: division ?? null,
        p_notes: notes ?? null,
      });
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ snapshot_id: data }, null, 2) }] };
    }
  );

  server.tool(
    "list_order_request_snapshots",
    "רשימת צילומי מצב — List snapshots, optionally filtered by division.",
    {
      division: z.string().optional(),
    },
    async ({ division }) => {
      let query = supabase
        .from("order_request_snapshots")
        .select("id, label, division, captured_at, captured_by_name, notes, total_requests, total_required_qty, total_estimated_value")
        .order("captured_at", { ascending: false });
      if (division) query = query.eq("division", division);
      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_order_request_snapshot",
    "צילום מצב — Read a single snapshot with full payload.",
    {
      snapshot_id: z.string().uuid(),
    },
    async ({ snapshot_id }) => {
      const { data, error } = await supabase
        .from("order_request_snapshots")
        .select("*")
        .eq("id", snapshot_id)
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_order_request_snapshot",
    "מחיקת צילום מצב — Delete a snapshot by id (managers only via RLS).",
    {
      snapshot_id: z.string().uuid(),
    },
    async ({ snapshot_id }) => {
      const { error } = await supabase
        .from("order_request_snapshots")
        .delete()
        .eq("id", snapshot_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: snapshot_id }) }] };
    }
  );

  server.tool(
    "fulfill_order_request",
    "מימוש בקשת הזמנה — Mark an order request as ordered and link it to an order.",
    {
      request_id: z.string().uuid().describe("Order request UUID"),
      order_id: z.string().uuid().describe("The orders table UUID that fulfills this request"),
      ordered_by_name: z.string().optional().describe("Name of the person who placed the order"),
    },
    async ({ request_id, order_id, ordered_by_name }) => {
      const { data, error } = await supabase
        .from("order_requests")
        .update({
          status: "ordered",
          order_id,
          ordered_at: new Date().toISOString(),
          ordered_by_name: ordered_by_name ?? null,
        })
        .eq("id", request_id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_profile_division",
    "שיוך חטיבה למשתמש — Assign or clear a division on a user profile (for division manager role).",
    {
      user_id: z.string().uuid().describe("Profile UUID (auth user id)"),
      division: z.string().nullable().describe("Division to assign, or null to clear. E.g. 'AWACS' | 'כפתור' | 'DOORE' | 'דלק מוטורס' | 'פריזבי קרסו' | 'לובינסקי'"),
    },
    async ({ user_id, division }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ division })
        .eq("id", user_id)
        .select("id, full_name, email, role, division")
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
