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
      product_id: z.string().uuid().optional().describe("Filter by product UUID — returns items for that product and its components"),
      search: z.string().optional().describe("Search by product name or SKU"),
      disposition_type: z.enum(["השמדה", "החזרה לספק", "מכירה"]).optional().describe("Filter by disposition type"),
      supplier_return_id: z.string().uuid().optional().describe("Filter by supplier return UUID"),
      limit: z.number().int().default(100).describe("Max results"),
    },
    async ({ in_use, source, created_by, product_id, search, disposition_type, supplier_return_id, limit }) => {
      let query = supabase
        .from("waste_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (in_use !== undefined) query = query.eq("in_use", in_use);
      if (source) query = query.eq("source", source);
      if (created_by) query = query.eq("created_by", created_by);
      if (product_id) {
        // Return items linked directly to the product OR to any of its components
        const { data: components } = await supabase
          .from("product_components")
          .select("id")
          .eq("product_id", product_id);
        const componentIds = (components || []).map((c: { id: string }) => c.id);
        const fkParts = [`product_id.eq.${product_id}`, ...componentIds.map((id: string) => `component_id.eq.${id}`)].join(",");
        query = query.or(fkParts);
      }
      if (search) {
        query = query.or(`product_name.ilike.%${search}%,sku.ilike.%${search}%`);
      }
      if (disposition_type) query = query.eq("disposition_type", disposition_type);
      if (supplier_return_id) query = query.eq("supplier_return_id", supplier_return_id);

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
      product_id: z.string().uuid().optional().describe("UUID of the linked product (from products table)"),
      component_id: z.string().uuid().optional().describe("UUID of the linked component (from product_components table); also set product_id to the component's parent product"),
    },
    async ({ product_name, sku, quantity, recommendations, in_use, product_id, component_id }) => {
      const { data, error } = await supabase
        .from("waste_items")
        .insert({ product_name, sku, quantity, recommendations, in_use, source: "manual", product_id, component_id })
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
      product_id: z.string().uuid().nullable().optional().describe("Updated product FK"),
      component_id: z.string().uuid().nullable().optional().describe("Updated component FK"),
      disposition_type: z.enum(["השמדה", "החזרה לספק", "מכירה"]).nullable().optional().describe("Disposition type"),
      disposition_date: z.string().optional().describe("ISO datetime when disposition was set"),
      sale_buyer_name: z.string().nullable().optional().describe("Buyer name for third-party sale"),
      sale_price: z.number().nullable().optional().describe("Sale price"),
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

  // ═══════════════════════════════════════════════════════════════
  // Supplier Returns — החזרות לספקים
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_supplier_returns",
    "החזרות לספקים — List supplier returns with optional filters.",
    {
      supplier_id: z.string().uuid().optional(),
      status: z.enum(["טיוטה", "נשלח", "התקבל אצל ספק", "הוסדר"]).optional(),
      limit: z.number().int().default(100),
    },
    async ({ supplier_id, status, limit }) => {
      let query = supabase
        .from("supplier_returns")
        .select("*, suppliers(name), waste_items(id)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (supplier_id) query = query.eq("supplier_id", supplier_id);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_supplier_return",
    "יצירת החזרה לספק — Create a supplier return and assign waste items to it.",
    {
      supplier_id: z.string().uuid(),
      return_reason: z.string().optional(),
      tracking_number: z.string().optional(),
      notes: z.string().optional(),
      waste_item_ids: z.array(z.string().uuid()).min(1).describe("Waste item IDs to include in this return"),
      created_by: z.string().uuid().optional(),
      created_by_name: z.string().optional(),
    },
    async ({ supplier_id, return_reason, tracking_number, notes, waste_item_ids, created_by, created_by_name }) => {
      const { data: ret, error: retErr } = await supabase
        .from("supplier_returns")
        .insert({ supplier_id, return_reason, tracking_number, notes, created_by, created_by_name })
        .select()
        .single();
      if (retErr) return { content: [{ type: "text" as const, text: `Error: ${retErr.message}` }] };

      const { error: itemErr } = await supabase
        .from("waste_items")
        .update({ supplier_return_id: ret.id, disposition_type: "החזרה לספק", disposition_date: new Date().toISOString() })
        .in("id", waste_item_ids);
      if (itemErr) return { content: [{ type: "text" as const, text: `Return created but items not linked: ${itemErr.message}` }] };

      return { content: [{ type: "text" as const, text: JSON.stringify(ret, null, 2) }] };
    }
  );

  server.tool(
    "update_supplier_return",
    "עדכון החזרה לספק — Update fields on a supplier return.",
    {
      id: z.string().uuid(),
      tracking_number: z.string().nullable().optional(),
      return_reason: z.string().nullable().optional(),
      resolution_type: z.enum(["זיכוי", "החלפה", "אחר"]).nullable().optional(),
      resolution_notes: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    },
    async ({ id, ...fields }) => {
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) updates[k] = v;
      const { data, error } = await supabase.from("supplier_returns").update(updates).eq("id", id).select().single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_supplier_return",
    "מחיקת החזרה לספק — Soft-delete a supplier return and unlink its waste items.",
    {
      id: z.string().uuid(),
    },
    async ({ id }) => {
      await supabase
        .from("waste_items")
        .update({ supplier_return_id: null, disposition_type: null, disposition_date: null })
        .eq("supplier_return_id", id);
      const { error } = await supabase.from("supplier_returns").delete().eq("id", id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: id }) }] };
    }
  );

  server.tool(
    "advance_supplier_return_status",
    "קידום סטטוס החזרה — Advance supplier return status to the next stage.",
    {
      id: z.string().uuid(),
      resolution_type: z.enum(["זיכוי", "החלפה", "אחר"]).optional().describe("Required when advancing to הוסדר"),
      resolution_notes: z.string().optional(),
    },
    async ({ id, resolution_type, resolution_notes }) => {
      const { data: current, error: fetchErr } = await supabase.from("supplier_returns").select("*").eq("id", id).single();
      if (fetchErr) return { content: [{ type: "text" as const, text: `Error: ${fetchErr.message}` }] };

      const transitions: Record<string, string> = {
        "טיוטה": "נשלח",
        "נשלח": "התקבל אצל ספק",
        "התקבל אצל ספק": "הוסדר",
      };
      const nextStatus = transitions[current.status];
      if (!nextStatus) return { content: [{ type: "text" as const, text: `Error: Cannot advance from ${current.status}` }] };

      if (nextStatus === "נשלח" && !current.tracking_number) {
        return { content: [{ type: "text" as const, text: "Error: tracking_number is required before shipping" }] };
      }
      if (nextStatus === "הוסדר" && !resolution_type) {
        return { content: [{ type: "text" as const, text: "Error: resolution_type is required to settle" }] };
      }

      const updates: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "נשלח") updates.shipped_at = new Date().toISOString();
      if (nextStatus === "התקבל אצל ספק") updates.received_at = new Date().toISOString();
      if (nextStatus === "הוסדר") {
        updates.settled_at = new Date().toISOString();
        if (resolution_type) updates.resolution_type = resolution_type;
        if (resolution_notes) updates.resolution_notes = resolution_notes;
      }

      const { data, error } = await supabase.from("supplier_returns").update(updates).eq("id", id).select().single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "set_waste_item_disposition",
    "סיווג פריט בלאי — Set disposition (destruction or sale) on a waste item.",
    {
      id: z.string().uuid(),
      disposition_type: z.enum(["השמדה", "מכירה"]),
      sale_buyer_name: z.string().optional(),
      sale_price: z.number().optional(),
    },
    async ({ id, disposition_type, sale_buyer_name, sale_price }) => {
      const { data, error } = await supabase
        .from("waste_items")
        .update({
          disposition_type,
          disposition_date: new Date().toISOString(),
          sale_buyer_name: sale_buyer_name ?? null,
          sale_price: sale_price ?? null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
