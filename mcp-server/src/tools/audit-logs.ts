import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerAuditLogTools(server: McpServer) {
  server.tool(
    "list_inventory_changes",
    "יומן שינויי מלאי — List inventory change audit entries with optional filters",
    {
      product_id: z.string().uuid().optional().describe("Filter by product UUID"),
      center_id: z.string().uuid().optional().describe("Filter by distribution center UUID"),
      change_type: z.string().optional().describe("Filter by change type"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ product_id, center_id, change_type, limit }) => {
      let query = supabase
        .from("inventory_change_log")
        .select("*, products(name, sku), distribution_centers(name)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (product_id) query = query.eq("product_id", product_id);
      if (center_id) query = query.eq("center_id", center_id);
      if (change_type) query = query.eq("change_type", change_type);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_task_advancements",
    "יומן קידום משימות — List task date-change audit entries",
    {
      task_id: z.string().uuid().optional().describe("Filter by task UUID"),
      advanced_by: z.string().optional().describe("Filter by who advanced the task"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ task_id, advanced_by, limit }) => {
      let query = supabase
        .from("task_advancement_log")
        .select("*, tasks(title)")
        .order("advanced_at", { ascending: false })
        .limit(limit);

      if (task_id) query = query.eq("task_id", task_id);
      if (advanced_by) query = query.eq("advanced_by", advanced_by);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
