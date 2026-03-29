import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerLearningJournalTools(server: McpServer) {
  server.tool(
    "list_learning_entries",
    "רשימת רשומות למידה — List learning journal entries",
    {
      status: z.string().optional().describe("Filter by status"),
      linked_type: z.string().optional().describe("Filter by linked entity type (e.g. product, order, supplier)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ status, linked_type, limit }) => {
      let query = supabase
        .from("learning_journal")
        .select("*")
        .order("date", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (linked_type) query = query.eq("linked_type", linked_type);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_learning_entry",
    "פרטי רשומת למידה — Get a single learning journal entry",
    {
      id: z.string().uuid().describe("Entry UUID"),
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("learning_journal")
        .select("*")
        .eq("id", id)
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_learning_entry",
    "יצירת רשומת למידה — Create a new learning journal entry",
    {
      title: z.string().describe("Entry title"),
      content: z.string().optional().describe("Entry content"),
      created_by: z.string().describe("Creator identifier (user UUID or name)"),
      date: z.string().optional().describe("Entry date (YYYY-MM-DD, defaults to today)"),
      status: z.string().optional().describe("Entry status"),
      linked_type: z.string().optional().describe("Linked entity type (e.g. product, order, supplier)"),
      linked_id: z.string().uuid().optional().describe("Linked entity UUID"),
    },
    async ({ title, content, created_by, date, status, linked_type, linked_id }) => {
      const { data, error } = await supabase
        .from("learning_journal")
        .insert({
          title,
          content: content || "",
          created_by,
          date: date || new Date().toISOString().split("T")[0],
          status: status || "active",
          linked_type: linked_type ?? null,
          linked_id: linked_id ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Learning entry created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_learning_entry",
    "עדכון רשומת למידה — Update a learning journal entry",
    {
      id: z.string().uuid().describe("Entry UUID"),
      title: z.string().optional().describe("Updated title"),
      content: z.string().optional().describe("Updated content"),
      status: z.string().optional().describe("Updated status"),
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
        .from("learning_journal")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Learning entry updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_learning_entry",
    "מחיקת רשומת למידה — Delete a learning journal entry",
    {
      id: z.string().uuid().describe("Entry UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("learning_journal")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Learning entry deleted successfully" }] };
    }
  );
}
