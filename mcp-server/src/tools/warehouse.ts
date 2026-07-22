import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerWarehouseTools(server: McpServer) {
  // ═══════════════════════════════════════════════════════════════
  // Warehouse Zones — אזורי מחסן
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_warehouse_zones",
    "אזורי מחסן — List all warehouse map zones with their layout, capacity and notes.",
    {
      zone_type: z.string().optional().describe("Filter by zone_type (e.g. 'storage', 'staging')"),
      is_non_product: z.boolean().optional().describe("Filter: true = non-product zones (aisles, walls), false = product zones"),
    },
    async ({ zone_type, is_non_product }) => {
      let query = supabase
        .from("warehouse_zones")
        .select("*")
        .order("sort_order")
        .order("grid_row")
        .order("grid_col");

      if (zone_type !== undefined) query = query.eq("zone_type", zone_type);
      if (is_non_product !== undefined) query = query.eq("is_non_product", is_non_product);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_warehouse_zone",
    "עדכון אזור מחסן — Update warehouse zone properties: name, color, capacity, notes, sort_order.",
    {
      id: z.string().describe("Zone id (TEXT, e.g. 'A1', 'B3')"),
      name: z.string().optional().describe("Zone display name"),
      color: z.string().optional().describe("Background color (hex or Tailwind class)"),
      text_color: z.string().optional().describe("Text color (hex or Tailwind class)"),
      capacity: z.number().int().min(0).optional().describe("Zone capacity (number of pallets / units)"),
      notes: z.string().nullable().optional().describe("Free-text notes for this zone"),
      sort_order: z.number().int().optional().describe("Display sort order"),
    },
    async ({ id, ...fields }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) patch[k] = v;
      }

      const { data, error } = await supabase
        .from("warehouse_zones")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Zone Products — מוצרים באזורים
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_zone_products",
    "מוצרים באזור — List all products assigned to a warehouse zone.",
    {
      zone_id: z.string().describe("Zone id (TEXT, e.g. 'A1')"),
    },
    async ({ zone_id }) => {
      const { data, error } = await supabase
        .from("warehouse_zone_products")
        .select(`
          id, zone_id, product_id, created_at,
          products(id, name, sku, category)
        `)
        .eq("zone_id", zone_id)
        .order("created_at");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "assign_product_to_zone",
    "שיוך מוצר לאזור — Assign a product to a warehouse zone.",
    {
      zone_id: z.string().describe("Zone id (TEXT, e.g. 'A1')"),
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ zone_id, product_id }) => {
      const { data, error } = await supabase
        .from("warehouse_zone_products")
        .insert({ zone_id, product_id })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "unassign_product_from_zone",
    "הסרת מוצר מאזור — Remove a product from a warehouse zone.",
    {
      zone_id: z.string().describe("Zone id (TEXT, e.g. 'A1')"),
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ zone_id, product_id }) => {
      const { error } = await supabase
        .from("warehouse_zone_products")
        .delete()
        .eq("zone_id", zone_id)
        .eq("product_id", product_id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, zone_id, product_id }) }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Zone Log — יומן שינויים
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "get_warehouse_zone_log",
    "יומן אזורי מחסן — Query the append-only audit log for warehouse zone changes.",
    {
      zone_id: z.string().optional().describe("Filter by zone id"),
      action: z.enum(["create", "update", "delete", "move"]).optional().describe("Filter by action type"),
      from_date: z.string().optional().describe("ISO date string, e.g. '2026-04-01'"),
      limit: z.number().int().default(50).describe("Max results"),
    },
    async ({ zone_id, action, from_date, limit }) => {
      let query = supabase
        .from("warehouse_zone_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (zone_id) query = query.eq("zone_id", zone_id);
      if (action) query = query.eq("action", action);
      if (from_date) query = query.gte("created_at", from_date);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
