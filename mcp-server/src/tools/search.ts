import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerSearchTools(server: McpServer) {
  server.tool(
    "global_search",
    "חיפוש גלובלי — Search across products, orders, suppliers, and documents by keyword",
    {
      query: z.string().describe("Search keyword"),
      modules: z.array(z.enum(["products", "orders", "suppliers", "documents"])).optional()
        .describe("Limit search to specific modules (omit for all)"),
      limit: z.number().default(10).describe("Max results per module"),
    },
    async ({ query, modules, limit }) => {
      const searchModules = modules || ["products", "orders", "suppliers", "documents"];
      const results: Record<string, unknown[]> = {};

      const promises: Array<PromiseLike<void>> = [];

      if (searchModules.includes("products")) {
        promises.push(
          supabase.from("products")
            .select("id, name, sku, category, supplier")
            .or(`name.ilike.%${query}%,sku.ilike.%${query}%,category.ilike.%${query}%`)
            .limit(limit)
            .then(({ data }) => { results.products = data || []; })
        );
      }

      if (searchModules.includes("orders")) {
        promises.push(
          supabase.from("orders")
            .select("id, supplier_name, status, notes, priority")
            .or(`supplier_name.ilike.%${query}%,notes.ilike.%${query}%`)
            .limit(limit)
            .then(({ data }) => { results.orders = data || []; })
        );
      }

      if (searchModules.includes("suppliers")) {
        promises.push(
          supabase.from("suppliers")
            .select("id, company, contact_name, country, products")
            .or(`company.ilike.%${query}%,contact_name.ilike.%${query}%,products.ilike.%${query}%`)
            .limit(limit)
            .then(({ data }) => { results.suppliers = data || []; })
        );
      }

      if (searchModules.includes("documents")) {
        promises.push(
          supabase.from("purchase_documents")
            .select("id, document_name, type, status, supplier_id")
            .ilike("document_name", `%${query}%`)
            .limit(limit)
            .then(({ data }) => { results.documents = data || []; })
        );
      }

      await Promise.all(promises);

      const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ total_results: totalResults, ...results }, null, 2) }],
      };
    }
  );

  server.tool(
    "get_supplier_full_picture",
    "תמונה מלאה של ספק — Orders, payments, documents, and issues for a supplier",
    {
      supplier_id: z.string().uuid().describe("Supplier UUID"),
    },
    async ({ supplier_id }) => {
      const [supplierRes, ordersRes, paymentsRes, docsRes, contactsRes] = await Promise.all([
        supabase.from("suppliers").select("*").eq("id", supplier_id).single(),
        supabase.from("orders").select("id, status, total_price, payment_status, eta, priority, created_at")
          .eq("supplier_id", supplier_id).order("created_at", { ascending: false }),
        supabase.from("supplier_payments").select("id, amount, currency, payment_type, status, due_date, paid_date")
          .eq("supplier_id", supplier_id).order("created_at", { ascending: false }),
        supabase.from("purchase_documents").select("id, document_name, type, status, created_at")
          .eq("supplier_id", supplier_id).order("created_at", { ascending: false }),
        supabase.from("supplier_contacts").select("*").eq("supplier_id", supplier_id),
      ]);

      if (supplierRes.error) return { content: [{ type: "text" as const, text: `Error: ${supplierRes.error.message}` }] };

      const orders = ordersRes.data || [];
      const payments = paymentsRes.data || [];

      const totalOrderValue = orders.reduce((sum: number, o: Record<string, unknown>) => sum + (Number(o.total_price) || 0), 0);
      const totalPaid = payments
        .filter((p: Record<string, unknown>) => p.status === "שולם" || p.paid_date)
        .reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);

      const result = {
        supplier: supplierRes.data,
        contacts: contactsRes.data || [],
        summary: {
          total_orders: orders.length,
          total_order_value: totalOrderValue,
          total_paid: totalPaid,
          outstanding_balance: totalOrderValue - totalPaid,
          total_documents: (docsRes.data || []).length,
        },
        orders,
        payments,
        documents: docsRes.data || [],
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_product_full_picture",
    "תמונה מלאה של מוצר — Stock, orders, issues, compliance, and components for a product",
    {
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ product_id }) => {
      const [productRes, componentsRes, issuesRes, complianceRes, orderItemsRes, inventoryRes] = await Promise.all([
        supabase.from("products").select("*").eq("id", product_id).single(),
        supabase.from("product_components").select("*").eq("product_id", product_id),
        supabase.from("product_issues").select("*").eq("product_id", product_id).order("reported_date", { ascending: false }),
        supabase.from("compliance_product_links").select("compliance_item_id, compliance_items(id, name, category, status, expiry_date)")
          .eq("product_id", product_id),
        supabase.from("order_items").select("id, order_id, qty, price, name, orders(id, status, supplier_name, eta)")
          .eq("product_id", product_id),
        supabase.from("center_inventory").select("quantity, min_stock, distribution_centers(id, name)")
          .eq("product_id", product_id),
      ]);

      if (productRes.error) return { content: [{ type: "text" as const, text: `Error: ${productRes.error.message}` }] };

      const issues = issuesRes.data || [];
      const openIssues = issues.filter((i: Record<string, unknown>) => i.status !== "נסגר");

      const result = {
        product: productRes.data,
        components: componentsRes.data || [],
        inventory_by_center: inventoryRes.data || [],
        issues: {
          total: issues.length,
          open: openIssues.length,
          items: issues,
        },
        compliance: (complianceRes.data || []).map((link: Record<string, unknown>) => link.compliance_items),
        order_history: orderItemsRes.data || [],
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_entity_timeline",
    "ציר זמן ישות — Get activity timeline for an order (status changes, payments, documents)",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      const [orderRes, paymentsRes, docsRes, itemsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", order_id).single(),
        supabase.from("supplier_payments").select("id, amount, currency, payment_type, status, created_at, paid_date")
          .eq("order_id", order_id).order("created_at"),
        supabase.from("purchase_documents").select("id, document_name, type, status, created_at")
          .eq("order_id", order_id).order("created_at"),
        supabase.from("order_items").select("id, name, qty, price").eq("order_id", order_id),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error: ${orderRes.error.message}` }] };

      // Build timeline events
      const events: Array<{ date: string; type: string; description: string }> = [];

      const order = orderRes.data;
      if (order.created_at) events.push({ date: order.created_at, type: "order_created", description: `Order created for ${order.supplier_name}` });
      if (order.order_date) events.push({ date: order.order_date, type: "order_date", description: "Order date set" });
      if (order.etd) events.push({ date: order.etd, type: "etd", description: "Estimated departure" });
      if (order.eta) events.push({ date: order.eta, type: "eta", description: "Estimated arrival" });

      for (const payment of paymentsRes.data || []) {
        const p = payment as Record<string, unknown>;
        events.push({
          date: p.created_at as string,
          type: "payment",
          description: `${p.payment_type} payment of ${p.amount} ${p.currency} (${p.status})`,
        });
      }

      for (const doc of docsRes.data || []) {
        const d = doc as Record<string, unknown>;
        events.push({
          date: d.created_at as string,
          type: "document",
          description: `${d.type} document: ${d.document_name} (${d.status})`,
        });
      }

      events.sort((a, b) => a.date.localeCompare(b.date));

      const result = {
        order,
        items: itemsRes.data || [],
        timeline: events,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
