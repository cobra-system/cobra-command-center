import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerTaskTools(server: McpServer) {
  server.tool(
    "list_tasks",
    "רשימת משימות חוזרות — List recurring tasks",
    {
      is_active: z.boolean().optional().describe("Filter by active/inactive"),
      frequency: z.string().optional().describe("Filter by frequency (daily, weekly, monthly)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ is_active, frequency, limit }) => {
      let query = supabase
        .from("recurring_tasks")
        .select("*")
        .order("next_due", { ascending: true })
        .limit(limit);

      if (is_active !== undefined) query = query.eq("is_active", is_active);
      if (frequency) query = query.eq("frequency", frequency);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_task",
    "יצירת משימה חוזרת — Create a new recurring task",
    {
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      frequency: z.enum(["daily", "weekly", "monthly"]).describe("How often the task recurs"),
      priority: z.string().optional().describe("Task priority"),
      assignee_name: z.string().optional().describe("Person assigned to this task"),
      day_of_week: z.number().min(0).max(6).optional().describe("Day of week (0=Sunday) for weekly tasks"),
      day_of_month: z.number().min(1).max(31).optional().describe("Day of month for monthly tasks"),
      next_due: z.string().optional().describe("Next due date (YYYY-MM-DD)"),
    },
    async ({ title, description, frequency, priority, assignee_name, day_of_week, day_of_month, next_due }) => {
      const { data, error } = await supabase
        .from("recurring_tasks")
        .insert({
          title,
          description: description || null,
          frequency,
          priority: priority || null,
          assignee_name: assignee_name || null,
          day_of_week: day_of_week ?? null,
          day_of_month: day_of_month ?? null,
          next_due: next_due || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Task created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_task",
    "עדכון משימה — Update a recurring task",
    {
      id: z.string().uuid().describe("Task UUID"),
      title: z.string().optional().describe("Updated title"),
      description: z.string().optional().describe("Updated description"),
      is_active: z.boolean().optional().describe("Activate or deactivate"),
      priority: z.string().optional().describe("Updated priority"),
      assignee_name: z.string().optional().describe("Updated assignee"),
      next_due: z.string().optional().describe("Updated next due date (YYYY-MM-DD)"),
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
        .from("recurring_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Task updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_task",
    "מחיקת משימה — Delete a recurring task",
    {
      id: z.string().uuid().describe("Task UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("recurring_tasks")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Task deleted successfully` }] };
    }
  );
}
