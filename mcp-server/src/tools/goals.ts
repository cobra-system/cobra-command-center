import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerGoalTools(server: McpServer) {
  server.tool(
    "list_goals",
    "רשימת מטרות-על — List all goals/milestones ordered by sort_order",
    {
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .limit(limit);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_goal",
    "יצירת מטרת-על — Create a new goal/milestone",
    {
      name: z.string().describe("Goal name (unique)"),
      color: z.string().default("#0e7490").describe("Goal color hex code"),
      sort_order: z.number().int().default(0).describe("Sort order for display"),
    },
    async ({ name, color, sort_order }) => {
      const { data, error } = await supabase
        .from("goals")
        .insert({ name, color, sort_order })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Goal created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_goal",
    "עדכון מטרת-על — Update a goal's name, color, or sort order",
    {
      id: z.string().uuid().describe("Goal UUID"),
      name: z.string().optional().describe("New goal name"),
      color: z.string().optional().describe("New color hex code"),
      sort_order: z.number().int().optional().describe("New sort order"),
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
        .from("goals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Goal updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_goal",
    "מחיקת מטרת-על — Delete a goal",
    {
      id: z.string().uuid().describe("Goal UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Goal deleted successfully" }] };
    }
  );
}
