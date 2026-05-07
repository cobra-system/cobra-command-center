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
          id, division, product_id, field_stock, field_stock_updated_at,
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
    "עדכון מוצר חטיבה — Create or update a product entry for a division. Updates field_stock, quarterly_demand, and/or notes.",
    {
      division: z.string().describe("Division name: 'AWACS' | 'כפתור' | 'DOORE' | 'דלק מוטורס' | 'פריזבי קרסו' | 'לובינסקי'"),
      product_id: z.string().uuid().describe("Product UUID"),
      field_stock: z.number().int().min(0).optional().describe("Current field stock quantity"),
      quarterly_demand: z.number().int().min(0).optional().describe("Quarterly demand forecast"),
      notes: z.string().optional().describe("Free-text notes"),
    },
    async ({ division, product_id, field_stock, quarterly_demand, notes }) => {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        division,
        product_id,
        updated_at: now,
      };
      if (field_stock !== undefined) {
        payload.field_stock = field_stock;
        payload.field_stock_updated_at = now;
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
      status: z.enum(["pending", "ordered"]).optional().describe("Filter by status: 'pending' | 'ordered'"),
    },
    async ({ division, status }) => {
      let query = supabase
        .from("order_requests")
        .select("*")
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
    "יצירת בקשת הזמנה — Create a new order request for a bonded division.",
    {
      division: z.string().describe("Division name: 'דלק מוטורס' | 'פריזבי קרסו' | 'לובינסקי'"),
      product_id: z.string().uuid().optional().describe("Product UUID (optional)"),
      product_name: z.string().describe("Product name (displayed in request)"),
      supplier: z.string().optional().describe("Supplier name (auto-populated from product)"),
      quantity: z.number().positive().describe("Requested quantity"),
      urgency: z.enum(["דחוף", "רגיל", "נמוך"]).describe("Request urgency"),
      order_type: z.enum(["מיידית", "חודשית", "רבעונית", "חצי שנתית"]).describe("Order frequency type"),
      current_consumption: z.string().optional().describe("Current consumption description"),
      reason: z.string().optional().describe("Reason for the order"),
    },
    async ({ division, product_id, product_name, supplier, quantity, urgency, order_type, current_consumption, reason }) => {
      const { data, error } = await supabase
        .from("order_requests")
        .insert({
          division,
          product_id: product_id ?? null,
          product_name,
          supplier: supplier ?? null,
          quantity,
          urgency,
          order_type,
          current_consumption: current_consumption ?? null,
          reason: reason ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
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
