import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerMeetingTools(server: McpServer) {
  server.tool(
    "list_meetings",
    "רשימת פגישות — List all meetings ordered by date, with action item counts",
    {
      limit:  z.number().default(50).describe("Max results"),
      search: z.string().optional().describe("Search by title or summary"),
      type:   z.enum(["procurement", "general", "other"]).optional().describe("Filter by meeting type"),
      status: z.enum(["open", "closed"]).optional().describe("Filter by meeting status"),
    },
    async ({ limit, search, type, status }) => {
      let query = supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: false })
        .limit(limit);

      if (search) query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
      if (type)   query = query.eq("type", type);
      if (status) query = query.eq("status", status);

      const { data: meetings, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      if (!meetings || meetings.length === 0) {
        return { content: [{ type: "text" as const, text: "[]" }] };
      }

      const meetingIds = meetings.map((m) => m.id);
      const { data: actionItems } = await supabase
        .from("meeting_action_items")
        .select("meeting_id, status")
        .in("meeting_id", meetingIds);

      const countsByMeeting: Record<string, { pending: number; done: number }> = {};
      for (const item of actionItems || []) {
        if (!countsByMeeting[item.meeting_id]) {
          countsByMeeting[item.meeting_id] = { pending: 0, done: 0 };
        }
        if (item.status === "done") {
          countsByMeeting[item.meeting_id].done++;
        } else {
          countsByMeeting[item.meeting_id].pending++;
        }
      }

      const result = meetings.map((m) => ({
        ...m,
        action_items_pending: countsByMeeting[m.id]?.pending ?? 0,
        action_items_done: countsByMeeting[m.id]?.done ?? 0,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_meeting",
    "פרטי פגישה — Get a single meeting with its action items",
    {
      id: z.string().uuid().describe("Meeting UUID"),
    },
    async ({ id }) => {
      const [meetingRes, actionItemsRes] = await Promise.all([
        supabase.from("meetings").select("*").eq("id", id).single(),
        supabase
          .from("meeting_action_items")
          .select("*")
          .eq("meeting_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (meetingRes.error) return { content: [{ type: "text" as const, text: `Error: ${meetingRes.error.message}` }] };

      const result = {
        ...meetingRes.data,
        action_items: actionItemsRes.data || [],
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_meeting",
    "יצירת פגישה — Create a new meeting",
    {
      title:        z.string().describe("Meeting title"),
      meeting_date: z.string().optional().describe("Meeting date/time (ISO 8601, e.g. 2026-04-01T10:00:00Z)"),
      summary:      z.string().optional().describe("Meeting summary"),
      notes:        z.string().optional().describe("Additional notes"),
      type:         z.enum(["procurement", "general", "other"]).default("general").describe("Meeting type (default: general)"),
    },
    async ({ title, meeting_date, summary, notes, type }) => {
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          title,
          meeting_date: meeting_date || null,
          summary: summary || null,
          notes: notes || null,
          type,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error creating meeting: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Meeting created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_meeting",
    "עדכון פגישה — Update a meeting's details",
    {
      id:           z.string().uuid().describe("Meeting UUID"),
      title:        z.string().optional().describe("Meeting title"),
      meeting_date: z.string().optional().describe("Meeting date/time (ISO 8601)"),
      summary:      z.string().optional().describe("Meeting summary"),
      notes:        z.string().optional().describe("Additional notes"),
      type:         z.enum(["procurement", "general", "other"]).optional().describe("Meeting type"),
      status:       z.enum(["open", "closed"]).optional().describe("Meeting status"),
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
        .from("meetings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error updating meeting: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Meeting updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_meeting",
    "מחיקת פגישה — Delete a meeting (cascades to action items and participants)",
    {
      id: z.string().uuid().describe("Meeting UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("meetings")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Meeting deleted successfully" }] };
    }
  );

  server.tool(
    "add_meeting_action_item",
    "הוספת פעולת מעקב לפגישה — Add an action item to a meeting",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
      content: z.string().describe("Action item description"),
      assignee_id: z.string().uuid().optional().describe("Assigned user UUID (profile id)"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    },
    async ({ meeting_id, content, assignee_id, due_date }) => {
      const { data, error } = await supabase
        .from("meeting_action_items")
        .insert({
          meeting_id,
          content,
          assignee_id: assignee_id || null,
          due_date: due_date || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error adding action item: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Action item added:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_meeting_action_item",
    "עדכון פעולת מעקב — Update a meeting action item (content, status, assignee, due date)",
    {
      id: z.string().uuid().describe("Action item UUID"),
      content: z.string().optional().describe("Action item description"),
      status: z.enum(["pending", "done"]).optional().describe("Status: pending or done"),
      assignee_id: z.string().uuid().optional().describe("Assigned user UUID"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    },
    async ({ id, content, status, assignee_id, due_date }) => {
      const updates: Record<string, unknown> = {};
      if (content !== undefined) updates.content = content;
      if (status !== undefined) updates.status = status;
      if (assignee_id !== undefined) updates.assignee_id = assignee_id;
      if (due_date !== undefined) updates.due_date = due_date;

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }

      const { data, error } = await supabase
        .from("meeting_action_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error updating action item: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Action item updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_meeting_action_item",
    "מחיקת פעולת מעקב — Delete a meeting action item",
    {
      id: z.string().uuid().describe("Action item UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("meeting_action_items")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Action item deleted successfully" }] };
    }
  );

  // --- meeting_participants tools ---

  server.tool(
    "list_meeting_participants",
    "משתתפי פגישה — List participants of a meeting",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
    },
    async ({ meeting_id }) => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .select("*")
        .eq("meeting_id", meeting_id)
        .order("created_at", { ascending: true });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "add_meeting_participant",
    "הוספת משתתף לפגישה — Add a participant to a meeting",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
      participant_type: z.enum(["profile", "supplier", "supplier_contact"]).describe("Participant type"),
      participant_id: z.string().uuid().describe("Participant UUID (profile, supplier, or supplier_contact ID)"),
    },
    async ({ meeting_id, participant_type, participant_id }) => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .insert({ meeting_id, participant_type, participant_id })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Participant added:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "remove_meeting_participant",
    "הסרת משתתף מפגישה — Remove a participant from a meeting",
    {
      id: z.string().uuid().describe("Meeting participant record UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("meeting_participants")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Participant removed successfully" }] };
    }
  );

  // --- meeting_documents tools ---

  server.tool(
    "list_meeting_documents",
    "מסמכי פגישה — List documents attached to a meeting",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
    },
    async ({ meeting_id }) => {
      const { data, error } = await supabase
        .from("meeting_documents")
        .select("*")
        .eq("meeting_id", meeting_id)
        .order("created_at", { ascending: true });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "add_meeting_document",
    "הוספת מסמך לפגישה — Attach a document record to a meeting",
    {
      meeting_id: z.string().uuid().describe("Meeting UUID"),
      document_name: z.string().describe("Document display name"),
      file_url: z.string().describe("URL of the document file"),
      created_by: z.string().uuid().optional().describe("UUID of the user who added the document"),
    },
    async ({ meeting_id, document_name, file_url, created_by }) => {
      const { data, error } = await supabase
        .from("meeting_documents")
        .insert({
          meeting_id,
          document_name,
          file_url,
          created_by: created_by || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Document added to meeting:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "remove_meeting_document",
    "הסרת מסמך מפגישה — Remove a document from a meeting",
    {
      id: z.string().uuid().describe("Meeting document record UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("meeting_documents")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Meeting document removed successfully" }] };
    }
  );
}
