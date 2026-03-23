import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerProductTools(server: McpServer) {
  server.tool(
    "list_products",
    "רשימת מוצרים — List/search products by name, category, or SKU",
    {
      search: z.string().optional().describe("Search term for name or SKU"),
      category: z.string().optional().describe("Filter by category"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ search, category, limit }) => {
      let query = supabase
        .from("products")
        .select("id, name, sku, category, product_type, stock_qty, incoming_qty, sale_price, purchase_price, supplier, division")
        .order("name")
        .limit(limit);

      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      if (category) query = query.eq("category", category);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_product",
    "פרטי מוצר מלאים — Get full product details including components",
    {
      id: z.string().uuid().describe("Product UUID"),
    },
    async ({ id }) => {
      const [productRes, componentsRes, issuesRes] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).single(),
        supabase.from("product_components").select("*").eq("product_id", id),
        supabase.from("product_issues").select("id, status, severity, description, reported_date").eq("product_id", id).order("reported_date", { ascending: false }).limit(10),
      ]);

      if (productRes.error) return { content: [{ type: "text" as const, text: `Error: ${productRes.error.message}` }] };

      const result = {
        ...productRes.data,
        components: componentsRes.data || [],
        recent_issues: issuesRes.data || [],
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_product",
    "עדכון מוצר — Update product fields (stock, prices, notes, etc.)",
    {
      id: z.string().uuid().describe("Product UUID"),
      stock_qty: z.number().optional().describe("Current stock quantity"),
      incoming_qty: z.number().optional().describe("Incoming quantity"),
      sale_price: z.number().optional().describe("Sale price"),
      purchase_price: z.number().optional().describe("Purchase price"),
      notes: z.string().optional().describe("Product notes"),
      reorder_point: z.number().optional().describe("Reorder point threshold"),
      monthly_sales: z.number().optional().describe("Monthly sales figure"),
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
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Product updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "create_product",
    "יצירת מוצר חדש — Create a new product",
    {
      name: z.string().describe("Product name"),
      sku: z.string().optional().describe("SKU / part number"),
      category: z.string().optional().describe("Product category"),
      division: z.string().optional().describe("Division"),
      product_type: z.string().optional().describe("Product type"),
      supplier: z.string().optional().describe("Supplier name"),
      purchase_price: z.number().optional().describe("Purchase price"),
      sale_price: z.number().optional().describe("Sale price"),
      stock_qty: z.number().default(0).describe("Current stock quantity"),
      incoming_qty: z.number().default(0).describe("Incoming quantity"),
      notes: z.string().optional().describe("Product notes"),
    },
    async ({ name, sku, category, division, product_type, supplier, purchase_price, sale_price, stock_qty, incoming_qty, notes }) => {
      const { data, error } = await supabase
        .from("products")
        .insert({
          name,
          sku: sku || null,
          category: category || null,
          division: division || null,
          product_type: product_type || null,
          supplier: supplier || null,
          purchase_price: purchase_price ?? null,
          sale_price: sale_price ?? null,
          stock_qty,
          incoming_qty,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Product created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_product",
    "מחיקת מוצר — Delete a product by ID",
    {
      id: z.string().uuid().describe("Product UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Product deleted successfully` }] };
    }
  );

  server.tool(
    "search_products",
    "חיפוש מוצר — Search products by SKU, partial name, or category",
    {
      sku: z.string().optional().describe("SKU (partial match)"),
      name: z.string().optional().describe("Product name (partial match)"),
      category: z.string().optional().describe("Category (exact match)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ sku, name, category, limit }) => {
      let query = supabase
        .from("products")
        .select("id, name, sku, category, product_type, stock_qty, incoming_qty, sale_price, purchase_price, supplier, division")
        .order("name")
        .limit(limit);

      if (sku) query = query.ilike("sku", `%${sku}%`);
      if (name) query = query.ilike("name", `%${name}%`);
      if (category) query = query.eq("category", category);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_product_by_sku",
    "משיכת מוצר לפי מק״ט — Get a product by exact SKU, including components",
    {
      sku: z.string().describe("Exact SKU / part number"),
    },
    async ({ sku }) => {
      const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("sku", sku)
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const { data: components } = await supabase
        .from("product_components")
        .select("*")
        .eq("product_id", product.id);

      const result = {
        ...product,
        components: components || [],
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
