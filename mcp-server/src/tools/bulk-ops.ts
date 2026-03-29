import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerBulkOpsTools(server: McpServer) {
  server.tool(
    "bulk_update_products",
    "עדכון מוצרים מרובים — Update fields on multiple products at once",
    {
      updates: z.array(z.object({
        id: z.string().uuid().describe("Product UUID"),
        stock_qty: z.number().optional().describe("New stock quantity"),
        incoming_qty: z.number().optional().describe("New incoming quantity"),
        sale_price: z.number().optional().describe("New sale price"),
        purchase_price: z.number().optional().describe("New purchase price"),
        reorder_point: z.number().optional().describe("New reorder point"),
        notes: z.string().optional().describe("Updated notes"),
      })).describe("Array of product updates"),
    },
    async ({ updates }) => {
      const results: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const { id, ...fields } of updates) {
        const updateFields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) updateFields[key] = value;
        }

        if (Object.keys(updateFields).length === 0) {
          results.push({ id, success: true, error: "No fields to update" });
          continue;
        }

        const { error } = await supabase
          .from("products")
          .update(updateFields)
          .eq("id", id);

        results.push({ id, success: !error, error: error?.message });
      }

      const successCount = results.filter(r => r.success).length;
      return {
        content: [{ type: "text" as const, text: `Updated ${successCount}/${updates.length} products:\n${JSON.stringify(results, null, 2)}` }],
      };
    }
  );

  server.tool(
    "bulk_update_order_status",
    "עדכון סטטוס הזמנות מרובות — Change status for multiple orders at once",
    {
      order_ids: z.array(z.string().uuid()).describe("Array of order UUIDs"),
      status: z.string().describe("New status to set"),
      notes: z.string().optional().describe("Optional notes to append"),
    },
    async ({ order_ids, status, notes }) => {
      const updateFields: Record<string, unknown> = { status };
      if (notes) updateFields.notes = notes;

      const results: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const id of order_ids) {
        const { error } = await supabase
          .from("orders")
          .update(updateFields)
          .eq("id", id);

        results.push({ id, success: !error, error: error?.message });
      }

      const successCount = results.filter(r => r.success).length;
      return {
        content: [{ type: "text" as const, text: `Updated ${successCount}/${order_ids.length} orders to status "${status}":\n${JSON.stringify(results, null, 2)}` }],
      };
    }
  );

  server.tool(
    "bulk_complete_tasks",
    "סיום משימות מרובות — Mark multiple task instances as DONE",
    {
      task_ids: z.array(z.string().uuid()).describe("Array of task UUIDs"),
      notes: z.string().optional().describe("Completion notes for all tasks"),
    },
    async ({ task_ids, notes }) => {
      const updates: Record<string, unknown> = {
        status: "DONE",
        updated_at: new Date().toISOString(),
      };
      if (notes) updates.notes = notes;

      const results: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const id of task_ids) {
        const { error } = await supabase
          .from("tasks")
          .update(updates)
          .eq("id", id);

        results.push({ id, success: !error, error: error?.message });
      }

      const successCount = results.filter(r => r.success).length;
      return {
        content: [{ type: "text" as const, text: `Completed ${successCount}/${task_ids.length} tasks:\n${JSON.stringify(results, null, 2)}` }],
      };
    }
  );

  server.tool(
    "bulk_assign_tasks",
    "הקצאת משימות מרובות — Assign multiple tasks to a team member",
    {
      task_ids: z.array(z.string().uuid()).describe("Array of task UUIDs"),
      assignee_name: z.string().describe("Assignee name"),
    },
    async ({ task_ids, assignee_name }) => {
      const results: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const id of task_ids) {
        const { error } = await supabase
          .from("tasks")
          .update({ assignee_name })
          .eq("id", id);

        results.push({ id, success: !error, error: error?.message });
      }

      const successCount = results.filter(r => r.success).length;
      return {
        content: [{ type: "text" as const, text: `Assigned ${successCount}/${task_ids.length} tasks to "${assignee_name}":\n${JSON.stringify(results, null, 2)}` }],
      };
    }
  );

  server.tool(
    "import_products_csv",
    "ייבוא מוצרים — Parse and create multiple products from structured data",
    {
      products: z.array(z.object({
        name: z.string().describe("Product name"),
        sku: z.string().optional().describe("SKU"),
        category: z.string().optional().describe("Category"),
        supplier: z.string().optional().describe("Supplier name"),
        purchase_price: z.number().optional().describe("Purchase price"),
        sale_price: z.number().optional().describe("Sale price"),
        stock_qty: z.number().default(0).describe("Stock quantity"),
        notes: z.string().optional().describe("Notes"),
      })).describe("Array of products to create"),
    },
    async ({ products }) => {
      const rows = products.map(p => ({
        name: p.name,
        sku: p.sku || null,
        category: p.category || null,
        supplier: p.supplier || null,
        purchase_price: p.purchase_price ?? null,
        sale_price: p.sale_price ?? null,
        stock_qty: p.stock_qty,
        notes: p.notes || null,
      }));

      const { data, error } = await supabase
        .from("products")
        .insert(rows)
        .select();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Imported ${(data || []).length} products:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );
}
