import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerUserPreferenceTools(server: McpServer) {
  server.tool(
    "get_user_preferences",
    "הגדרות משתמש לדף — Get a user's saved preferences for a specific page",
    {
      user_id: z.string().uuid().describe("User UUID"),
      page_name: z.string().describe("Page name (e.g. products, orders, tasks)"),
    },
    async ({ user_id, page_name }) => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user_id)
        .eq("page_name", page_name)
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "upsert_user_preferences",
    "שמירת הגדרות משתמש — Create or update user preferences for a page",
    {
      user_id: z.string().uuid().describe("User UUID"),
      page_name: z.string().describe("Page name (e.g. products, orders, tasks)"),
      sort_field: z.string().optional().describe("Sort field name"),
      sort_dir: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
      filters: z.string().optional().describe("JSON string of filter settings"),
    },
    async ({ user_id, page_name, sort_field, sort_dir, filters }) => {
      const row: Record<string, unknown> = { user_id, page_name };
      if (sort_field !== undefined) row.sort_field = sort_field;
      if (sort_dir !== undefined) row.sort_dir = sort_dir;
      if (filters !== undefined) {
        try {
          row.filters = JSON.parse(filters);
        } catch {
          return { content: [{ type: "text" as const, text: "Error: filters must be a valid JSON string" }] };
        }
      }

      const { data, error } = await supabase
        .from("user_preferences")
        .upsert(row, { onConflict: "user_id,page_name" })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Preferences saved:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_user_preferences",
    "מחיקת הגדרות משתמש — Reset user preferences for a page",
    {
      user_id: z.string().uuid().describe("User UUID"),
      page_name: z.string().describe("Page name"),
    },
    async ({ user_id, page_name }) => {
      const { error } = await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", user_id)
        .eq("page_name", page_name);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Preferences deleted successfully" }] };
    }
  );
}
