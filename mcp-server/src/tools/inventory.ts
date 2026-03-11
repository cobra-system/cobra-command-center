import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerInventoryTools(server: McpServer) {
  server.tool(
    "list_centers",
    "רשימת מרכזי הפצה — List distribution centers",
    {},
    async () => {
      const { data, error } = await supabase
        .from("distribution_centers")
        .select("*")
        .order("name");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_center_inventory",
    "מלאי מרכז הפצה — Get inventory for a distribution center",
    {
      center_id: z.string().uuid().describe("Distribution center UUID"),
    },
    async ({ center_id }) => {
      const [centerRes, inventoryRes] = await Promise.all([
        supabase.from("distribution_centers").select("*").eq("id", center_id).single(),
        supabase.from("center_inventory").select("*, products(name, sku)").eq("center_id", center_id),
      ]);

      if (centerRes.error) return { content: [{ type: "text" as const, text: `Error: ${centerRes.error.message}` }] };

      const result = {
        center: centerRes.data,
        inventory: inventoryRes.data || [],
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_inventory",
    "עדכון מלאי במרכז הפצה — Update stock quantity at a distribution center",
    {
      center_id: z.string().uuid().describe("Distribution center UUID"),
      product_id: z.string().uuid().describe("Product UUID"),
      quantity: z.number().describe("New quantity"),
      min_stock: z.number().optional().describe("Minimum stock threshold"),
    },
    async ({ center_id, product_id, quantity, min_stock }) => {
      // Try to update existing record first
      const { data: existing } = await supabase
        .from("center_inventory")
        .select("id")
        .eq("center_id", center_id)
        .eq("product_id", product_id)
        .single();

      if (existing) {
        const updates: Record<string, unknown> = { quantity };
        if (min_stock !== undefined) updates.min_stock = min_stock;

        const { data, error } = await supabase
          .from("center_inventory")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
        return { content: [{ type: "text" as const, text: `Inventory updated:\n${JSON.stringify(data, null, 2)}` }] };
      } else {
        const { data, error } = await supabase
          .from("center_inventory")
          .insert({
            center_id,
            product_id,
            quantity,
            min_stock: min_stock ?? 0,
          })
          .select()
          .single();

        if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
        return { content: [{ type: "text" as const, text: `Inventory record created:\n${JSON.stringify(data, null, 2)}` }] };
      }
    }
  );
}
