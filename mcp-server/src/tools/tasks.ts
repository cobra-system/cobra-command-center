import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

const PRIORITY_ENUM = ["דחוף", "גבוה", "בינוני", "נמוך"] as const;
const STATUS_ENUM = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
const PRIORITY_DESC = "עדיפות: דחוף (urgent), גבוה (high), בינוני (medium), נמוך (low)";

async function resolveAssignee(name: string): Promise<
  { assignee_id: string; assignee_name: string } | { error: string }
> {
  const { data } = await supabase
    .from("profiles")
    .select("id, name")
    .ilike("name", `%${name}%`)
    .order("name");

  if (!data || data.length === 0) {
    const { data: all } = await supabase.from("profiles").select("name").order("name");
    const names = all?.map((p: { name: string }) => p.name).join(", ") ?? "—";
    return { error: `לא נמצא משתמש בשם "${name}". אנשי צוות קיימים: ${names}` };
  }
  if (data.length > 1) {
    const matches = data.map((p: { name: string }) => p.name).join(", ");
    return { error: `שם "${name}" מתאים ליותר מאחד: ${matches} — פרט יותר` };
  }
  return { assignee_id: data[0].id, assignee_name: data[0].name };
}

export function registerTaskTools(server: McpServer) {
  server.tool(
    "list_tasks",
    "רשימת תבניות משימות חוזרות — List recurring task TEMPLATES (not individual instances). Use list_task_instances for actual to-do items.",
    {
      is_active: z.boolean().optional().describe("Filter by active/inactive"),
      frequency: z.enum(["daily", "weekly", "monthly", "annual"]).optional().describe("Filter by frequency: daily, weekly, monthly, annual"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ is_active, frequency, limit }) => {
      let query = supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
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
      frequency: z.enum(["daily", "weekly", "monthly", "annual"]).describe("How often the task recurs"),
      priority: z.enum(PRIORITY_ENUM).optional().describe(PRIORITY_DESC),
      assignee_name: z.string().optional().describe("שם של חבר צוות קיים במערכת — must match a real profile name"),
      day_of_week: z.number().min(0).max(6).optional().describe("Day of week (0=Sunday) for weekly tasks"),
      day_of_month: z.number().min(1).max(31).optional().describe("Day of month for monthly/annual tasks"),
      month_of_year: z.number().min(0).max(11).optional().describe("Month of year (0=January) for annual tasks"),
      end_date: z.string().optional().describe("Optional cutoff date (YYYY-MM-DD) after which the recurring template stops"),
      category: z.string().optional().describe("Task category"),
    },
    async ({ title, description, frequency, priority, assignee_name, day_of_week, day_of_month, month_of_year, end_date, category }) => {
      const insert: Record<string, unknown> = {
        title,
        description: description || null,
        frequency,
        priority: priority || "בינוני",
        day_of_week: day_of_week ?? null,
        day_of_month: day_of_month ?? null,
        month_of_year: month_of_year ?? null,
        end_date: end_date || null,
        category: category || null,
        is_active: true,
        status: "TEMPLATE",
        is_daily: false,
      };

      if (assignee_name) {
        const resolved = await resolveAssignee(assignee_name);
        if ("error" in resolved) return { content: [{ type: "text" as const, text: resolved.error }] };
        insert.assignee_id = resolved.assignee_id;
        insert.assignee_name = resolved.assignee_name;
      }

      const { data, error } = await supabase.from("tasks").insert(insert).select().single();
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
      assignee: z.string().optional().describe("שם של חבר צוות קיים במערכת — must match a real profile name"),
      due_date: z.string().optional().describe("Due date in ISO 8601 format (e.g. 2026-04-15)"),
      priority: z.enum(PRIORITY_ENUM).optional().describe(PRIORITY_DESC),
      status: z.enum([...STATUS_ENUM]).optional().describe("Initial status: TODO, IN_PROGRESS, DONE, BLOCKED"),
      category: z.string().optional().describe("Task category"),
      created_by: z.string().uuid().optional().describe("UUID of the user creating the task"),
    },
    async ({ title, description, assignee, due_date, priority, status, category, created_by }) => {
      const insert: Record<string, unknown> = {
        title,
        description: description || null,
        due_date: due_date || null,
        priority: priority || "בינוני",
        status: status || "TODO",
        category: category || null,
        created_by: created_by || null,
        is_daily: false,
      };

      if (assignee) {
        const resolved = await resolveAssignee(assignee);
        if ("error" in resolved) return { content: [{ type: "text" as const, text: resolved.error }] };
        insert.assignee_id = resolved.assignee_id;
        insert.assignee_name = resolved.assignee_name;
      }

      const { data, error } = await supabase.from("tasks").insert(insert).select().single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `One-time task created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_task",
    "עדכון משימה — Update a task (template or instance)",
    {
      id: z.string().uuid().describe("Task UUID"),
      title: z.string().optional().describe("Updated title"),
      description: z.string().optional().describe("Updated description"),
      is_active: z.boolean().optional().describe("Activate or deactivate"),
      priority: z.enum(PRIORITY_ENUM).optional().describe(PRIORITY_DESC),
      assignee_name: z.string().optional().describe("שם של חבר צוות קיים במערכת — must match a real profile name"),
      category: z.string().optional().describe("Task category"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      status: z.enum([...STATUS_ENUM]).optional().describe("Status: TODO, IN_PROGRESS, DONE, BLOCKED"),
      milestone: z.string().optional().describe("Goal/milestone name"),
      notes: z.string().optional().describe("Task notes"),
      frequency: z.enum(["daily", "weekly", "monthly", "annual"]).optional().describe("Recurrence frequency"),
      day_of_week: z.number().min(0).max(6).optional().describe("Day of week (0=Sunday) for weekly tasks"),
      day_of_month: z.number().min(1).max(31).optional().describe("Day of month for monthly/annual tasks"),
      month_of_year: z.number().min(0).max(11).optional().describe("Month of year (0=January) for annual tasks"),
      end_date: z.string().optional().describe("Optional cutoff date (YYYY-MM-DD) for recurring template"),
    },
    async ({ id, assignee_name, ...fields }) => {
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updates[key] = value;
      }

      if (assignee_name !== undefined) {
        const resolved = await resolveAssignee(assignee_name);
        if ("error" in resolved) return { content: [{ type: "text" as const, text: resolved.error }] };
        updates.assignee_id = resolved.assignee_id;
        updates.assignee_name = resolved.assignee_name;
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
    "רשימת מופעי משימות — List actual task instances (the items people work on). Use list_tasks for recurring templates.",
    {
      status: z.enum([...STATUS_ENUM]).optional().describe("Filter by status"),
      assignee_name: z.string().optional().describe("Filter by assignee name (partial match)"),
      is_daily: z.boolean().optional().describe("Filter daily tasks only"),
      category: z.string().optional().describe("Filter by category"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ status, assignee_name, is_daily, category, limit }) => {
      let query = supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .neq("status", "TEMPLATE")
        .order("due_date", { ascending: true })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (assignee_name) query = query.ilike("assignee_name", `%${assignee_name}%`);
      if (is_daily !== undefined) query = query.eq("is_daily", is_daily);
      if (category) query = query.eq("category", category);

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
        completed_at: new Date().toISOString(),
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
