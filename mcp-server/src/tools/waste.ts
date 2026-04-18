import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerWasteTools(server: McpServer) {
  // ═══════════════════════════════════════════════════════════════
  // Waste Items — פריטי פסולת / נפסלים
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_waste_items",
    "פריטי נפסלים — List waste/scrap items with optional filters.",
    {
      in_use: z.boolean().optional().describe("Filter by in-use status"),
      source: z.enum(["manual", "equipment_return"]).optional().describe("Filter by source"),
      created_by: z.string().uuid().optional().describe("Filter by creator user UUID"),
      search: z.string().optional().describe("Search by product name or SKU"),
      limit: z.number().int().default(100).describe("Max results"),
    },
    async ({ in_use, source, created_by, search, limit }) => {
      let query = supabase
        .from("waste_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (in_use !== undefined) query = query.eq("in_use", in_use);
      if (source) query = query.eq("source", source);
      if (created_by) query = query.eq("created_by", created_by);
      if (search) {
        query = query.or(`product_name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_waste_item",
    "יצירת פריט נפסל — Create a new manual waste/scrap entry.",
    {
      product_name: z.string().describe("Product name"),
      sku: z.string().optional().describe("Product SKU"),
      quantity: z.number().int().min(1).default(1).describe("Quantity"),
      recommendations: z.string().optional().describe("Recommendations or notes on handling"),
      in_use: z.boolean().default(false).describe("Whether the item is currently in use"),
    },
    async ({ product_name, sku, quantity, recommendations, in_use }) => {
      const { data, error } = await supabase
        .from("waste_items")
        .insert({ product_name, sku, quantity, recommendations, in_use, source: "manual" })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_waste_item",
    "עדכון פריט נפסל — Update fields on a waste item.",
    {
      id: z.string().uuid().describe("Waste item UUID"),
      product_name: z.string().optional().describe("Updated product name"),
      sku: z.string().optional().describe("Updated SKU"),
      quantity: z.number().int().min(1).optional().describe("Updated quantity"),
      recommendations: z.string().nullable().optional().describe("Updated recommendations"),
      in_use: z.boolean().optional().describe("Updated in-use status"),
    },
    async ({ id, ...fields }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) patch[k] = v;
      }

      const { data, error } = await supabase
        .from("waste_items")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_waste_item",
    "מחיקת פריט נפסל — Delete a waste item by id.",
    {
      id: z.string().uuid().describe("Waste item UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("waste_items")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: id }) }] };
    }
  );

  server.tool(
    "toggle_waste_item_in_use",
    "החלפת סטטוס שימוש — Toggle the in_use flag on a waste item.",
    {
      id: z.string().uuid().describe("Waste item UUID"),
      in_use: z.boolean().describe("New in-use value"),
    },
    async ({ id, in_use }) => {
      const { data, error } = await supabase
        .from("waste_items")
        .update({ in_use, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, product_name, in_use")
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
