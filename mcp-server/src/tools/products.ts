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
    "עדכון מוצר — Update editable product fields including name, sku, category, division, product_type, and supplier. NOTE: incoming_qty is computed live from active orders; monthly_sales is computed from pickup history — do not set these manually.",
    {
      id: z.string().uuid().describe("Product UUID"),
      name: z.string().optional().describe("Product name"),
      sku: z.string().optional().describe("SKU / part number"),
      category: z.string().optional().describe("Product category"),
      division: z.string().optional().describe("Comma-separated divisions assigned to this product (e.g. \"AWCAS, כפתור\")"),
      product_type: z.string().optional().describe("Product type: מוגמר (finished) or מורכב (composite)"),
      supplier: z.string().optional().describe("Supplier name"),
      stock_qty: z.number().optional().describe("Physical stock quantity (manually maintained)"),
      sale_price: z.number().optional().describe("Sale price ($)"),
      purchase_price: z.number().optional().describe("Purchase price ($) — for composite products this is calculated automatically from component prices"),
      notes: z.string().optional().describe("Product notes"),
      description: z.string().optional().describe("Product description"),
      reorder_point: z.number().optional().describe("Reorder point threshold"),
      monthly_order: z.number().optional().describe("Planned monthly order quantity (manually set)"),
      monthly_sales_avg: z.number().optional().describe("Manual monthly sales average — fallback used only when no pickup history exists"),
      lead_time_days: z.number().optional().describe("Lead time in days"),
      supplier_origin: z.string().optional().describe("Supplier origin country"),
      shipping: z.string().optional().describe("Shipping method"),
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
    "יצירת מוצר חדש — Create a new product. incoming_qty and monthly_sales are computed automatically and cannot be set on creation.",
    {
      name: z.string().describe("Product name"),
      sku: z.string().optional().describe("SKU / part number"),
      category: z.string().optional().describe("Product category"),
      division: z.string().optional().describe("Division"),
      product_type: z.string().optional().describe("Product type: מוגמר (finished) or מורכב (composite)"),
      supplier: z.string().optional().describe("Supplier name"),
      purchase_price: z.number().optional().describe("Purchase price ($)"),
      sale_price: z.number().optional().describe("Sale price ($)"),
      stock_qty: z.number().default(0).describe("Initial physical stock quantity"),
      notes: z.string().optional().describe("Product notes"),
      description: z.string().optional().describe("Product description"),
      lead_time_days: z.number().optional().describe("Lead time in days"),
      supplier_origin: z.string().optional().describe("Supplier origin country"),
      shipping: z.string().optional().describe("Shipping method"),
      reorder_point: z.number().optional().describe("Reorder point threshold"),
      monthly_order: z.number().optional().describe("Planned monthly order quantity"),
    },
    async ({ name, sku, category, division, product_type, supplier, purchase_price, sale_price, stock_qty, notes, description, lead_time_days, supplier_origin, shipping, reorder_point, monthly_order }) => {
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
          notes: notes || null,
          description: description || null,
          lead_time_days: lead_time_days ?? null,
          supplier_origin: supplier_origin || null,
          shipping: shipping || null,
          reorder_point: reorder_point ?? null,
          monthly_order: monthly_order ?? null,
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
      const { error: oiError } = await supabase
        .from("order_items")
        .update({ product_id: null })
        .eq("product_id", id);
      if (oiError) return { content: [{ type: "text" as const, text: `Error: ${oiError.message}` }] };

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
      image_url: z.string().optional().describe("Photo URL for this component"),
    },
    async ({ product_id, name, sku, supplier, origin, price, stock_qty, notes, image_url }) => {
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
          image_url: image_url ?? null,
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
      image_url: z.string().nullable().optional().describe("Photo URL for this component (null to clear)"),
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

  server.tool(
    "assign_product_division",
    "שיוך חטיבה למוצר — Assign or update which divisions a product belongs to. Accepts a comma-separated list of division names. Updating division here will auto-sync all related orders via DB trigger.",
    {
      id: z.string().uuid().describe("Product UUID"),
      division: z.string().describe(
        "Comma-separated division names to assign, e.g. \"AWCAS, כפתור\". Use empty string to clear all divisions."
      ),
    },
    async ({ id, division }) => {
      const { data, error } = await supabase
        .from("products")
        .update({ division: division || null })
        .eq("id", id)
        .select("id, name, sku, division")
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return {
        content: [{
          type: "text" as const,
          text: `Division updated (related orders will auto-sync via trigger):\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "get_product_supplier_payments",
    "תשלומים לספק עבור מוצר — Calculate total payments made to the supplier for a product, attributed proportionally by the product's share of each order's total value. Returns monthly (current month) and quarterly (current quarter) totals.",
    {
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ product_id }) => {
      // Fetch all order_items containing this product with their orders and payments
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id, qty, price, orders!inner(id, total_price, supplier_name, order_payments(amount, currency, paid_date, status))")
        .eq("product_id", product_id);

      if (itemsError) return { content: [{ type: "text" as const, text: `Error: ${itemsError.message}` }] };
      if (!items || items.length === 0) {
        return { content: [{ type: "text" as const, text: "No orders found for this product." }] };
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().split("T")[0];

      let monthly = 0;
      let quarterly = 0;
      let currency = "USD";
      const breakdown: Record<string, unknown>[] = [];

      for (const item of items as Record<string, unknown>[]) {
        const order = item.orders as Record<string, unknown>;
        const orderTotal = Number(order.total_price) || 0;
        const itemValue = (Number(item.qty) || 1) * (Number(item.price) || 0);
        const proportion = orderTotal > 0 ? itemValue / orderTotal : 1;

        const payments = (order.order_payments as Record<string, unknown>[]) || [];
        for (const p of payments) {
          if (p.status !== "שולם" || !p.paid_date) continue;
          const amount = Number(p.amount) || 0;
          const attributed = amount * proportion;
          currency = (p.currency as string) || "USD";

          if ((p.paid_date as string) >= startOfMonth) monthly += attributed;
          if ((p.paid_date as string) >= startOfQuarter) quarterly += attributed;
          breakdown.push({
            order_id: item.order_id,
            supplier: order.supplier_name,
            paid_date: p.paid_date,
            payment_amount: amount,
            product_proportion: Math.round(proportion * 100) + "%",
            attributed_amount: Math.round(attributed * 100) / 100,
            currency,
          });
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            product_id,
            currency,
            monthly_total: Math.round(monthly * 100) / 100,
            quarterly_total: Math.round(quarterly * 100) / 100,
            period: {
              month_from: startOfMonth,
              quarter_from: startOfQuarter,
            },
            breakdown,
          }, null, 2),
        }],
      };
    }
  );

  // ── Category management ────────────────────────────────────────────────────

  server.tool(
    "list_product_categories",
    "רשימת קטגוריות מוצרים — List all product categories (default + custom)",
    {},
    async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name, is_default, sort_order")
        .order("sort_order")
        .order("name");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "add_product_category",
    "הוספת קטגוריה — Add a new custom product category",
    {
      name: z.string().describe("Category name (Hebrew or any text)"),
    },
    async ({ name }) => {
      const { data, error } = await supabase
        .from("product_categories")
        .insert({ name: name.trim(), is_default: false })
        .select("id, name")
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Category added: ${JSON.stringify(data)}` }] };
    }
  );

  server.tool(
    "rename_product_category",
    "שינוי שם קטגוריה — Rename a custom product category (cannot rename default categories)",
    {
      id: z.string().uuid().describe("Category UUID"),
      new_name: z.string().describe("New category name"),
    },
    async ({ id, new_name }) => {
      const { data, error } = await supabase
        .from("product_categories")
        .update({ name: new_name.trim() })
        .eq("id", id)
        .eq("is_default", false)
        .select("id, name")
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!data) return { content: [{ type: "text" as const, text: "Category not found or is a default category (cannot rename)" }] };
      return { content: [{ type: "text" as const, text: `Category renamed: ${JSON.stringify(data)}` }] };
    }
  );

  server.tool(
    "delete_product_category",
    "מחיקת קטגוריה — Delete a custom product category (cannot delete default categories)",
    {
      id: z.string().uuid().describe("Category UUID"),
    },
    async ({ id }) => {
      const { error, count } = await supabase
        .from("product_categories")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("is_default", false);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (count === 0) return { content: [{ type: "text" as const, text: "Category not found or is a default category (cannot delete)" }] };
      return { content: [{ type: "text" as const, text: "Category deleted successfully" }] };
    }
  );
}
