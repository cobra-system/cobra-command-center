import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerTaskTools(server: McpServer) {
  server.tool(
    "list_tasks",
    "רשימת משימות חוזרות — List recurring task templates",
    {
      is_active: z.boolean().optional().describe("Filter by active/inactive"),
      frequency: z.string().optional().describe("Filter by frequency (daily, weekly, monthly)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ is_active, frequency, limit }) => {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("status", "TEMPLATE")
        .order("title")
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
    "יצירת משימה חוזרת — Create a new recurring task template",
    {
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      frequency: z.enum(["daily", "weekly", "monthly"]).describe("How often the task recurs"),
      priority: z.string().optional().describe("Task priority"),
      assignee_name: z.string().optional().describe("Person assigned to this task"),
      day_of_week: z.number().min(0).max(6).optional().describe("Day of week (0=Sunday) for weekly tasks"),
      day_of_month: z.number().min(1).max(31).optional().describe("Day of month for monthly tasks"),
    },
    async ({ title, description, frequency, priority, assignee_name, day_of_week, day_of_month }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title,
          description: description || null,
          frequency,
          priority: priority || "בינוני",
          assignee_name: assignee_name || null,
          day_of_week: day_of_week ?? null,
          day_of_month: day_of_month ?? null,
          is_active: true,
          status: "TEMPLATE",
          is_daily: false,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Task created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "create_one_time_task",
    "יצירת משימה חד-פעמית — Create a one-time (non-recurring) task",
    {
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      assignee: z.string().optional().describe("Person assigned (e.g. זיו, ג'ורג', נועם)"),
      category: z.string().optional().describe("Category (e.g. לוגיסטיקה, רכש, כללי)"),
      due_date: z.string().optional().describe("Due date in ISO 8601 format (e.g. 2026-04-15)"),
      priority: z.enum(["P0", "P1", "P2", "P3"]).optional().describe("Priority level"),
      status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional().describe("Initial status"),
    },
    async ({ title, description, assignee, category, due_date, priority, status }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title,
          description: description || null,
          assignee_name: assignee || null,
          category: category || null,
          due_date: due_date || null,
          priority: priority || "P2",
          status: status || "TODO",
          is_daily: false,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `One-time task created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_task",
    "עדכון משימה — Update a recurring task template",
    {
      id: z.string().uuid().describe("Task UUID"),
      title: z.string().optional().describe("Updated title"),
      description: z.string().optional().describe("Updated description"),
      is_active: z.boolean().optional().describe("Activate or deactivate"),
      priority: z.string().optional().describe("Updated priority"),
      assignee_name: z.string().optional().describe("Updated assignee"),
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
        .from("tasks")
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
    "מחיקת משימה — Delete a recurring task template",
    {
      id: z.string().uuid().describe("Task UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Task deleted successfully` }] };
    }
  );

  server.tool(
    "list_task_instances",
    "רשימת משימות — List individual task instances (the actual to-do items)",
    {
      status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]).optional().describe("Filter by status"),
      assignee_name: z.string().optional().describe("Filter by assignee name"),
      is_daily: z.boolean().optional().describe("Filter daily tasks only"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ status, assignee_name, is_daily, limit }) => {
      let query = supabase
        .from("tasks")
        .select("*")
        .neq("status", "TEMPLATE")
        .order("due_date", { ascending: true })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (assignee_name) query = query.ilike("assignee_name", `%${assignee_name}%`);
      if (is_daily !== undefined) query = query.eq("is_daily", is_daily);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "complete_task_instance",
    "סיום משימה — Mark a task instance as DONE",
    {
      id: z.string().uuid().describe("Task UUID"),
      notes: z.string().optional().describe("Completion notes"),
    },
    async ({ id, notes }) => {
      const updates: Record<string, unknown> = {
        status: "DONE",
        updated_at: new Date().toISOString(),
      };
      if (notes) updates.notes = notes;

      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Task marked as DONE:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );
}
