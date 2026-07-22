import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerComplianceTools(server: McpServer) {
  server.tool(
    "list_compliance_items",
    "רשימת פריטי ציות — List all compliance items, optionally filtered by category or status",
    {
      category: z.string().optional().describe("Filter by category (e.g. 'רגולציה', 'בטיחות')"),
      status: z.enum(["active", "expired", "pending"]).optional().describe("Filter by status: active, expired, pending"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ category, status, limit }) => {
      let query = supabase
        .from("compliance_items")
        .select("*")
        .is("deleted_at", null)
        .order("expiry_date", { ascending: true })
        .limit(limit);

      if (category) query = query.eq("category", category);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_compliance_item",
    "פרטי פריט ציות — Get a single compliance item with its linked products",
    {
      id: z.string().uuid().describe("Compliance item UUID"),
    },
    async ({ id }) => {
      const [itemRes, linksRes] = await Promise.all([
        supabase.from("compliance_items").select("*").eq("id", id).single(),
        supabase
          .from("compliance_product_links")
          .select("id, product_id, products(id, name, sku)")
          .eq("compliance_item_id", id),
      ]);

      if (itemRes.error) return { content: [{ type: "text" as const, text: `Error: ${itemRes.error.message}` }] };

      const result = {
        ...itemRes.data,
        linked_products: linksRes.data || [],
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_compliance_item",
    "יצירת פריט ציות — Create a new compliance item",
    {
      name: z.string().describe("Item name"),
      category: z.string().describe("Category (e.g. 'רגולציה', 'בטיחות', 'ייבוא')"),
      status: z.enum(["active", "expired", "pending"]).default("active").describe("Status: active, expired, pending"),
      expiry_date: z.string().optional().describe("Expiry date (ISO 8601, e.g. 2026-12-31)"),
      renewal_contact: z.string().optional().describe("Contact person for renewal"),
      notes: z.string().optional().describe("Additional notes"),
      product_id: z.string().uuid().optional().describe("Directly linked product UUID"),
    },
    async ({ name, category, status, expiry_date, renewal_contact, notes, product_id }) => {
      const { data, error } = await supabase
        .from("compliance_items")
        .insert({
          name,
          category,
          status,
          expiry_date: expiry_date || null,
          renewal_contact: renewal_contact || null,
          notes: notes || null,
          product_id: product_id || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error creating compliance item: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Compliance item created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_compliance_item",
    "עדכון פריט ציות — Update an existing compliance item",
    {
      id: z.string().uuid().describe("Compliance item UUID"),
      name: z.string().optional().describe("Item name"),
      category: z.string().optional().describe("Category"),
      status: z.enum(["active", "expired", "pending"]).optional().describe("Status: active, expired, pending"),
      expiry_date: z.string().optional().describe("Expiry date (ISO 8601)"),
      renewal_contact: z.string().optional().describe("Renewal contact"),
      notes: z.string().optional().describe("Notes"),
      document_url: z.string().optional().describe("URL of attached document"),
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
        .from("compliance_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error updating compliance item: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Compliance item updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_compliance_item",
    "מחיקת פריט ציות — Delete a compliance item by ID",
    {
      id: z.string().uuid().describe("Compliance item UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("compliance_items")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Compliance item deleted successfully" }] };
    }
  );

  server.tool(
    "link_compliance_to_product",
    "קישור ציות למוצר — Link a compliance item to a product",
    {
      compliance_item_id: z.string().uuid().describe("Compliance item UUID"),
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ compliance_item_id, product_id }) => {
      const { data, error } = await supabase
        .from("compliance_product_links")
        .insert({ compliance_item_id, product_id })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error linking compliance to product: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Link created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "unlink_compliance_from_product",
    "ביטול קישור ציות ממוצר — Remove a compliance-product link",
    {
      compliance_item_id: z.string().uuid().describe("Compliance item UUID"),
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ compliance_item_id, product_id }) => {
      const { error } = await supabase
        .from("compliance_product_links")
        .delete()
        .eq("compliance_item_id", compliance_item_id)
        .eq("product_id", product_id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Compliance-product link removed successfully" }] };
    }
  );
}
