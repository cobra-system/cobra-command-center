import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerNotificationTools(server: McpServer) {
  server.tool(
    "list_alerts",
    "רשימת התראות — List all active alerts: expiring compliance, low stock, overdue payments, late ETAs",
    {
      days_ahead: z.number().default(30).describe("Look-ahead window in days for expiring items"),
    },
    async ({ days_ahead }) => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const futureDate = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [complianceRes, productsRes, paymentsRes, ordersRes, tasksRes] = await Promise.all([
        // Expiring compliance items
        supabase.from("compliance_items").select("id, name, category, expiry_date, renewal_contact")
          .eq("status", "active").lte("expiry_date", futureDate).order("expiry_date"),
        // Low stock products
        supabase.from("products").select("id, name, sku, stock_qty, reorder_point")
          .gt("reorder_point", 0),
        // Pending payments
        supabase.from("supplier_payments").select("id, supplier_id, amount, currency, due_date, status")
          .in("status", ["ממתין", "pending"]).order("due_date"),
        // Orders with late ETA
        supabase.from("orders").select("id, supplier_name, status, eta, priority")
          .not("status", "in", '("הושלמה","בוטלה")').lt("eta", today),
        // Overdue tasks
        supabase.from("tasks").select("id, title, due_date, assignee_name, priority")
          .neq("status", "TEMPLATE").neq("status", "DONE").lt("due_date", today),
      ]);

      const lowStockProducts = (productsRes.data || []).filter((p: Record<string, unknown>) =>
        (Number(p.stock_qty) || 0) <= (Number(p.reorder_point) || 0)
      );

      const alerts = {
        expiring_compliance: {
          count: (complianceRes.data || []).length,
          items: complianceRes.data || [],
        },
        low_stock: {
          count: lowStockProducts.length,
          items: lowStockProducts,
        },
        pending_payments: {
          count: (paymentsRes.data || []).length,
          items: paymentsRes.data || [],
        },
        late_orders: {
          count: (ordersRes.data || []).length,
          items: ordersRes.data || [],
        },
        overdue_tasks: {
          count: (tasksRes.data || []).length,
          items: tasksRes.data || [],
        },
        total_alerts:
          (complianceRes.data || []).length +
          lowStockProducts.length +
          (paymentsRes.data || []).length +
          (ordersRes.data || []).length +
          (tasksRes.data || []).length,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(alerts, null, 2) }] };
    }
  );

  server.tool(
    "get_critical_alerts",
    "התראות קריטיות — Only high-priority items requiring immediate attention",
    {},
    async () => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [complianceRes, productsRes, ordersRes, issuesRes] = await Promise.all([
        // Compliance expiring within 7 days
        supabase.from("compliance_items").select("id, name, category, expiry_date, renewal_contact")
          .eq("status", "active").lte("expiry_date", sevenDays).order("expiry_date"),
        // Products with zero stock
        supabase.from("products").select("id, name, sku, stock_qty, reorder_point")
          .eq("stock_qty", 0).gt("reorder_point", 0),
        // Late high-priority orders
        supabase.from("orders").select("id, supplier_name, status, eta, priority")
          .not("status", "in", '("הושלמה","בוטלה")').lt("eta", today).eq("priority", "דחוף"),
        // Critical open issues
        supabase.from("product_issues").select("id, description, severity, status, product_id")
          .eq("severity", "קריטי").neq("status", "נסגר"),
      ]);

      const critical = {
        expiring_compliance_7d: complianceRes.data || [],
        zero_stock_products: productsRes.data || [],
        late_urgent_orders: ordersRes.data || [],
        critical_issues: issuesRes.data || [],
        total_critical:
          (complianceRes.data || []).length +
          (productsRes.data || []).length +
          (ordersRes.data || []).length +
          (issuesRes.data || []).length,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(critical, null, 2) }] };
    }
  );

  server.tool(
    "check_reorder_needs",
    "בדיקת צורך בהזמנה מחדש — Products below reorder point with suggested order quantities",
    {
      include_incoming: z.boolean().default(true).describe("Consider incoming stock in calculation"),
    },
    async ({ include_incoming }) => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, stock_qty, incoming_qty, reorder_point, monthly_sales, supplier, purchase_price")
        .gt("reorder_point", 0)
        .order("name");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const needsReorder = (data || []).filter((p: Record<string, unknown>) => {
        const available = include_incoming
          ? (Number(p.stock_qty) || 0) + (Number(p.incoming_qty) || 0)
          : (Number(p.stock_qty) || 0);
        return available <= (Number(p.reorder_point) || 0);
      }).map((p: Record<string, unknown>) => {
        const monthlySales = Number(p.monthly_sales) || 0;
        const suggestedQty = monthlySales > 0 ? Math.ceil(monthlySales * 2) : Number(p.reorder_point) || 10;
        const estimatedCost = suggestedQty * (Number(p.purchase_price) || 0);

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          current_stock: p.stock_qty,
          incoming_qty: p.incoming_qty,
          reorder_point: p.reorder_point,
          monthly_sales: monthlySales,
          suggested_order_qty: suggestedQty,
          estimated_cost: estimatedCost,
          supplier: p.supplier,
        };
      });

      const result = {
        products_needing_reorder: needsReorder.length,
        total_estimated_cost: needsReorder.reduce((sum, p) => sum + p.estimated_cost, 0),
        items: needsReorder,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
