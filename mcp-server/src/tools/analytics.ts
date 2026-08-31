import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { unwrapRows } from "../lib/queryResult.js";

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    "get_dashboard_kpis",
    "מדדי דשבורד — Get key performance indicators: order counts, revenue, pending payments, low-stock alerts",
    {
      date_from: z.string().optional().describe("Start date for period (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date for period (YYYY-MM-DD)"),
    },
    async ({ date_from, date_to }) => {
      const [ordersRes, productsRes, paymentsRes, complianceRes, tasksRes] = await Promise.all([
        supabase.from("orders").select("id, status, total_price, created_at"),
        supabase.from("products").select("id, name, sku, stock_qty, reorder_point"),
        supabase.from("supplier_payments").select("id, amount, status, currency"),
        supabase.from("compliance_items").select("id, status, expiry_date"),
        supabase.from("tasks").select("id, status, due_date").neq("status", "TEMPLATE"),
      ]);

      const orders = unwrapRows(ordersRes, "orders");
      const products = unwrapRows(productsRes, "products");
      const payments = unwrapRows(paymentsRes, "payments");
      const compliance = unwrapRows(complianceRes, "compliance");
      const tasks = unwrapRows(tasksRes, "tasks");

      // Filter orders by date range if provided
      let filteredOrders = orders;
      if (date_from) filteredOrders = filteredOrders.filter((o: Record<string, unknown>) => (o.created_at as string) >= date_from);
      if (date_to) filteredOrders = filteredOrders.filter((o: Record<string, unknown>) => (o.created_at as string) <= date_to + "T23:59:59");

      const totalOrders = filteredOrders.length;
      const ordersByStatus: Record<string, number> = {};
      let totalRevenue = 0;
      for (const order of filteredOrders) {
        const status = (order.status as string) || "unknown";
        ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
        totalRevenue += Number(order.total_price) || 0;
      }

      // Low stock products
      const lowStockProducts = products.filter((p: Record<string, unknown>) => {
        const qty = Number(p.stock_qty) || 0;
        const reorder = Number(p.reorder_point) || 0;
        return reorder > 0 && qty <= reorder;
      });

      // Pending payments
      const pendingPayments = payments.filter((p: Record<string, unknown>) => p.status === "ממתין" || p.status === "pending");
      const pendingPaymentTotal = pendingPayments.reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);

      // Expiring compliance (next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const expiringCompliance = compliance.filter((c: Record<string, unknown>) =>
        c.expiry_date && (c.expiry_date as string) <= thirtyDaysFromNow && c.status === "active"
      );

      // Overdue tasks
      const today = now.toISOString().split("T")[0];
      const overdueTasks = tasks.filter((t: Record<string, unknown>) =>
        t.due_date && (t.due_date as string) < today && t.status !== "DONE"
      );

      const kpis = {
        orders: {
          total: totalOrders,
          by_status: ordersByStatus,
          total_revenue: totalRevenue,
        },
        products: {
          total: products.length,
          low_stock_count: lowStockProducts.length,
          low_stock_items: lowStockProducts.map((p: Record<string, unknown>) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock_qty: p.stock_qty,
            reorder_point: p.reorder_point,
          })),
        },
        payments: {
          pending_count: pendingPayments.length,
          pending_total: pendingPaymentTotal,
        },
        compliance: {
          expiring_within_30_days: expiringCompliance.length,
        },
        tasks: {
          overdue_count: overdueTasks.length,
        },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(kpis, null, 2) }] };
    }
  );

  server.tool(
    "get_sales_velocity",
    "מהירות מכירות — Get sales velocity data for products to support reorder planning",
    {
      product_id: z.string().uuid().optional().describe("Specific product UUID (omit for all)"),
      limit: z.number().default(50).describe("Max products to return"),
    },
    async ({ product_id, limit }) => {
      let query = supabase
        .from("products")
        .select("id, name, sku, stock_qty, incoming_qty, monthly_sales, reorder_point, sale_price, purchase_price")
        .order("monthly_sales", { ascending: false })
        .limit(limit);

      if (product_id) query = query.eq("id", product_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const velocity = (data || []).map((p: Record<string, unknown>) => {
        const stock = Number(p.stock_qty) || 0;
        const incoming = Number(p.incoming_qty) || 0;
        const monthlySales = Number(p.monthly_sales) || 0;
        const dailySales = monthlySales / 30;
        const daysOfStock = dailySales > 0 ? Math.round((stock + incoming) / dailySales) : null;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock_qty: stock,
          incoming_qty: incoming,
          monthly_sales: monthlySales,
          daily_sales: Math.round(dailySales * 100) / 100,
          days_of_stock: daysOfStock,
          reorder_point: p.reorder_point,
          needs_reorder: p.reorder_point ? stock <= Number(p.reorder_point) : false,
        };
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(velocity, null, 2) }] };
    }
  );

  server.tool(
    "get_supplier_performance",
    "ביצועי ספקים — Get supplier performance metrics: order count, issue rate, avg lead time",
    {
      supplier_id: z.string().uuid().optional().describe("Specific supplier UUID (omit for all)"),
      limit: z.number().default(20).describe("Max suppliers to return"),
    },
    async ({ supplier_id, limit }) => {
      let suppliersQuery = supabase.from("suppliers").select("id, company, country, lead_time_days, risk_level").order("company").limit(limit);
      if (supplier_id) suppliersQuery = suppliersQuery.eq("id", supplier_id);

      const { data: suppliers, error: suppError } = await suppliersQuery;
      if (suppError) return { content: [{ type: "text" as const, text: `Error: ${suppError.message}` }] };

      const supplierIds = (suppliers || []).map((s: Record<string, unknown>) => s.id as string);
      if (supplierIds.length === 0) {
        return { content: [{ type: "text" as const, text: "No suppliers found" }] };
      }

      const [ordersRes, issuesRes] = await Promise.all([
        supabase.from("orders").select("id, supplier_id, status, total_price").in("supplier_id", supplierIds),
        supabase.from("product_issues").select("id, product_id, severity, status"),
      ]);

      // Get products per supplier for issue mapping
      const { data: productsData } = await supabase.from("products").select("id, supplier");

      const productsBySupplier: Record<string, string[]> = {};
      for (const p of productsData || []) {
        const sup = (p as Record<string, unknown>).supplier as string;
        if (sup) {
          if (!productsBySupplier[sup]) productsBySupplier[sup] = [];
          productsBySupplier[sup].push((p as Record<string, unknown>).id as string);
        }
      }

      const orders = unwrapRows(ordersRes, "orders");
      const issues = unwrapRows(issuesRes, "issues");

      const performance = (suppliers || []).map((s: Record<string, unknown>) => {
        const supplierOrders = orders.filter((o: Record<string, unknown>) => o.supplier_id === s.id);
        const orderTotal = supplierOrders.reduce((sum: number, o: Record<string, unknown>) => sum + (Number(o.total_price) || 0), 0);

        // Find issues for products from this supplier
        const supplierProductIds = productsBySupplier[s.company as string] || [];
        const supplierIssues = issues.filter((i: Record<string, unknown>) =>
          supplierProductIds.includes(i.product_id as string)
        );

        return {
          id: s.id,
          company: s.company,
          country: s.country,
          lead_time_days: s.lead_time_days,
          risk_level: s.risk_level,
          total_orders: supplierOrders.length,
          total_order_value: orderTotal,
          open_issues: supplierIssues.filter((i: Record<string, unknown>) => i.status !== "נסגר").length,
          total_issues: supplierIssues.length,
        };
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(performance, null, 2) }] };
    }
  );

  server.tool(
    "get_inventory_valuation",
    "שווי מלאי — Get inventory valuation by center or product",
    {
      center_id: z.string().uuid().optional().describe("Filter by distribution center UUID"),
    },
    async ({ center_id }) => {
      let invQuery = supabase.from("center_inventory").select("*, products(id, name, sku, purchase_price, sale_price), distribution_centers(id, name)");
      if (center_id) invQuery = invQuery.eq("center_id", center_id);

      const { data, error } = await invQuery;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      let totalPurchaseValue = 0;
      let totalSaleValue = 0;

      const items = (data || []).map((row: Record<string, unknown>) => {
        const product = row.products as Record<string, unknown> | null;
        const center = row.distribution_centers as Record<string, unknown> | null;
        const qty = Number(row.quantity) || 0;
        const purchasePrice = Number(product?.purchase_price) || 0;
        const salePrice = Number(product?.sale_price) || 0;
        const purchaseValue = qty * purchasePrice;
        const saleValue = qty * salePrice;

        totalPurchaseValue += purchaseValue;
        totalSaleValue += saleValue;

        return {
          center_name: center?.name,
          product_name: product?.name,
          product_sku: product?.sku,
          quantity: qty,
          purchase_price: purchasePrice,
          sale_price: salePrice,
          purchase_value: purchaseValue,
          sale_value: saleValue,
        };
      });

      const result = {
        total_purchase_value: totalPurchaseValue,
        total_sale_value: totalSaleValue,
        potential_margin: totalSaleValue - totalPurchaseValue,
        item_count: items.length,
        items,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_order_pipeline",
    "צינור הזמנות — Orders grouped by status with totals",
    {},
    async () => {
      const { data, error } = await supabase.from("orders").select("id, status, total_price, priority, supplier_name, eta");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const pipeline: Record<string, { count: number; total_value: number; orders: Array<Record<string, unknown>> }> = {};

      for (const order of data || []) {
        const status = (order.status as string) || "unknown";
        if (!pipeline[status]) pipeline[status] = { count: 0, total_value: 0, orders: [] };
        pipeline[status].count++;
        pipeline[status].total_value += Number(order.total_price) || 0;
        pipeline[status].orders.push({
          id: order.id,
          supplier_name: order.supplier_name,
          total_price: order.total_price,
          priority: order.priority,
          eta: order.eta,
        });
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(pipeline, null, 2) }] };
    }
  );

  server.tool(
    "get_overdue_items",
    "פריטים באיחור — Get all overdue items across modules: tasks, compliance, orders",
    {},
    async () => {
      const today = new Date().toISOString().split("T")[0];

      const [tasksRes, complianceRes, ordersRes] = await Promise.all([
        supabase.from("tasks").select("id, title, status, due_date, assignee_name, priority")
          .neq("status", "TEMPLATE").neq("status", "DONE").lt("due_date", today),
        supabase.from("compliance_items").select("id, name, category, expiry_date, status, renewal_contact")
          .eq("status", "active").lt("expiry_date", today),
        supabase.from("orders").select("id, supplier_name, status, eta, priority")
          .not("status", "in", '("ARRIVED","CANCELLED")').lt("eta", today),
      ]);

      const result = {
        overdue_tasks: {
          count: (unwrapRows(tasksRes, "tasks")).length,
          items: unwrapRows(tasksRes, "tasks"),
        },
        expired_compliance: {
          count: (unwrapRows(complianceRes, "compliance")).length,
          items: unwrapRows(complianceRes, "compliance"),
        },
        late_orders: {
          count: (unwrapRows(ordersRes, "orders")).length,
          items: unwrapRows(ordersRes, "orders"),
        },
        total_overdue: (unwrapRows(tasksRes, "tasks")).length + (unwrapRows(complianceRes, "compliance")).length + (unwrapRows(ordersRes, "orders")).length,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
