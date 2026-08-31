import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { unwrapRows } from "../lib/queryResult.js";

export function registerInventoryTools(server: McpServer) {
  server.tool(
    "list_centers",
    "רשימת מרכזי הפצה — List distribution centers",
    {},
    async () => {
      const { data, error } = await supabase
        .from("distribution_centers")
        .select("*")
        .is("deleted_at", null)
        .order("name");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_distribution_center",
    "יצירת מרכז הפצה — Create a new distribution center",
    {
      name: z.string().describe("Center name"),
      type: z.string().default("warehouse").describe("Center type (e.g. warehouse, store, office)"),
      address: z.string().optional().describe("Address"),
      city: z.string().optional().describe("City"),
      is_main: z.boolean().default(false).describe("Is this the main center?"),
    },
    async ({ name, type, address, city, is_main }) => {
      const { data, error } = await supabase
        .from("distribution_centers")
        .insert({
          name,
          type,
          address: address || null,
          city: city || null,
          is_main,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Distribution center created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_distribution_center",
    "עדכון מרכז הפצה — Update a distribution center's details",
    {
      id: z.string().uuid().describe("Center UUID"),
      name: z.string().optional().describe("Center name"),
      type: z.string().optional().describe("Center type"),
      address: z.string().optional().describe("Address"),
      city: z.string().optional().describe("City"),
      is_main: z.boolean().optional().describe("Is this the main center?"),
    },
    async ({ id, ...fields }) => {
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updates[key] = value;
      }

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }

      const { data, error } = await supabase
        .from("distribution_centers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Distribution center updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_distribution_center",
    "מחיקת מרכז הפצה — Delete a distribution center",
    {
      id: z.string().uuid().describe("Center UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("distribution_centers")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Distribution center deleted successfully" }] };
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
        inventory: unwrapRows(inventoryRes, "inventory"),
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

  // --- Inventory Transfers ---

  server.tool(
    "create_inventory_transfer",
    "העברת מלאי בין מרכזים — Transfer stock from one distribution center to another",
    {
      product_id: z.string().uuid().describe("Product UUID"),
      from_center_id: z.string().uuid().describe("Source distribution center UUID"),
      to_center_id: z.string().uuid().describe("Destination distribution center UUID"),
      quantity: z.number().min(1).describe("Quantity to transfer"),
      transferred_by: z.string().uuid().optional().describe("User UUID performing the transfer"),
      notes: z.string().optional().describe("Transfer notes"),
    },
    async ({ product_id, from_center_id, to_center_id, quantity, transferred_by, notes }) => {
      const { data, error } = await supabase
        .from("inventory_transfers")
        .insert({
          product_id,
          from_center_id,
          to_center_id,
          quantity,
          transferred_by: transferred_by ?? null,
          notes: notes ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Transfer created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_inventory_transfers",
    "רשימת העברות מלאי — List inventory transfers between centers",
    {
      product_id: z.string().uuid().optional().describe("Filter by product UUID"),
      from_center_id: z.string().uuid().optional().describe("Filter by source center UUID"),
      to_center_id: z.string().uuid().optional().describe("Filter by destination center UUID"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ product_id, from_center_id, to_center_id, limit }) => {
      let query = supabase
        .from("inventory_transfers")
        .select("*, products(name, sku), from_center:distribution_centers!inventory_transfers_from_center_id_fkey(name), to_center:distribution_centers!inventory_transfers_to_center_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (product_id) query = query.eq("product_id", product_id);
      if (from_center_id) query = query.eq("from_center_id", from_center_id);
      if (to_center_id) query = query.eq("to_center_id", to_center_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // --- Center Contacts ---

  server.tool(
    "list_center_contacts",
    "אנשי קשר במרכז הפצה — List contacts for a distribution center",
    {
      center_id: z.string().uuid().describe("Distribution center UUID"),
    },
    async ({ center_id }) => {
      const { data, error } = await supabase
        .from("center_contacts")
        .select("*")
        .eq("center_id", center_id)
        .order("name");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_center_contact",
    "יצירת איש קשר במרכז הפצה — Add a contact to a distribution center",
    {
      center_id: z.string().uuid().describe("Distribution center UUID"),
      name: z.string().describe("Contact name"),
      phone: z.string().optional().describe("Phone number"),
      role: z.string().optional().describe("Contact role"),
    },
    async ({ center_id, name, phone, role }) => {
      const { data, error } = await supabase
        .from("center_contacts")
        .insert({
          center_id,
          name,
          phone: phone ?? null,
          role: role ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Contact created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_center_contact",
    "מחיקת איש קשר במרכז הפצה — Remove a contact from a distribution center",
    {
      id: z.string().uuid().describe("Contact UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("center_contacts")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Contact deleted successfully" }] };
    }
  );
}
