import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerProductTools(server: McpServer) {
  server.tool(
    "list_products",
    "רשימת מוצרים — List products with optional name/SKU search. Use search_products for precise field-by-field search.",
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
      description: z.string().optional().describe("Product description"),
      reorder_point: z.number().optional().describe("Reorder point threshold"),
      monthly_sales: z.number().optional().describe("Monthly sales figure"),
      monthly_order: z.number().optional().describe("Monthly order quantity"),
      monthly_sales_avg: z.number().optional().describe("Monthly sales average"),
      lead_time_days: z.number().optional().describe("Lead time in days"),
      sap_code: z.string().optional().describe("SAP code"),
      supplier_origin: z.string().optional().describe("Supplier origin country"),
      shipping: z.string().optional().describe("Shipping method/info"),
      end_product_image: z.string().optional().describe("End product image URL"),
      end_product_url: z.string().optional().describe("End product URL"),
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
      description: z.string().optional().describe("Product description"),
      sap_code: z.string().optional().describe("SAP code"),
      lead_time_days: z.number().optional().describe("Lead time in days"),
      supplier_origin: z.string().optional().describe("Supplier origin country"),
      shipping: z.string().optional().describe("Shipping method/info"),
      reorder_point: z.number().optional().describe("Reorder point threshold"),
    },
    async ({ name, sku, category, division, product_type, supplier, purchase_price, sale_price, stock_qty, incoming_qty, notes, description, sap_code, lead_time_days, supplier_origin, shipping, reorder_point }) => {
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
          description: description || null,
          sap_code: sap_code || null,
          lead_time_days: lead_time_days ?? null,
          supplier_origin: supplier_origin || null,
          shipping: shipping || null,
          reorder_point: reorder_point ?? null,
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
    "חיפוש מוצר מדויק — Search products by specific SKU, name, or category fields separately. Use list_products for general browsing.",
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

  // --- Product Components ---

  server.tool(
    "list_product_components",
    "רכיבי מוצר — List all components of a product",
    {
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ product_id }) => {
      const { data, error } = await supabase
        .from("product_components")
        .select("*")
        .eq("product_id", product_id)
        .order("name");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_product_component",
    "הוספת רכיב למוצר — Add a component to a product",
    {
      product_id: z.string().uuid().describe("Product UUID"),
      name: z.string().describe("Component name"),
      sku: z.string().optional().describe("Component SKU"),
      supplier: z.string().optional().describe("Component supplier"),
      origin: z.string().optional().describe("Origin country"),
      price: z.number().optional().describe("Component price"),
      stock_qty: z.number().optional().describe("Stock quantity"),
      notes: z.string().optional().describe("Notes"),
    },
    async ({ product_id, name, sku, supplier, origin, price, stock_qty, notes }) => {
      const { data, error } = await supabase
        .from("product_components")
        .insert({
          product_id,
          name,
          sku: sku ?? null,
          supplier: supplier ?? null,
          origin: origin ?? null,
          price: price ?? null,
          stock_qty: stock_qty ?? null,
          notes: notes ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Component created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_product_component",
    "עדכון רכיב מוצר — Update a product component",
    {
      id: z.string().uuid().describe("Component UUID"),
      name: z.string().optional().describe("Component name"),
      sku: z.string().optional().describe("Component SKU"),
      supplier: z.string().optional().describe("Supplier"),
      origin: z.string().optional().describe("Origin country"),
      price: z.number().optional().describe("Price"),
      stock_qty: z.number().optional().describe("Stock quantity"),
      notes: z.string().optional().describe("Notes"),
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
        .from("product_components")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Component updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_product_component",
    "מחיקת רכיב מוצר — Delete a product component",
    {
      id: z.string().uuid().describe("Component UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("product_components")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Component deleted successfully" }] };
    }
  );
}
