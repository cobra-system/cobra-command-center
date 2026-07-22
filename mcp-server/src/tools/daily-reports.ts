import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

const cobraUpdateSchema = z.object({
  order_name: z.string(),
  description: z.string(),
});

const actionItemSchema = z.object({
  text: z.string(),
  priority: z.enum(["red", "orange", "yellow"]),
  done: z.boolean().optional(),
});

const pendingClarificationSchema = z.object({
  supplier: z.string(),
  issue: z.string(),
});

const mailDraftSchema = z.object({
  recipient: z.string(),
  subject: z.string(),
  body: z.string(),
  status: z.string().optional(),
});

const newFileSchema = z.object({
  filename: z.string(),
  folder: z.string(),
});

const meetingSchema = z.object({
  time: z.string(),
  title: z.string(),
  topics: z.string(),
});

export function registerDailyReportTools(server: McpServer) {
  server.tool(
    "create_daily_report",
    "יצירת סקירת בוקר — Creates or replaces the daily report for a given date",
    {
      report_date: z.string().describe("Report date (YYYY-MM-DD)"),
      day_name: z.string().optional().describe("Hebrew day name"),
      cobra_updates: z.array(cobraUpdateSchema).optional().describe("Array of {order_name, description}"),
      action_items: z.array(actionItemSchema).optional().describe("Array of {text, priority: red|orange|yellow}"),
      pending_clarifications: z.array(pendingClarificationSchema).optional().describe("Array of {supplier, issue}"),
      mail_drafts: z.array(mailDraftSchema).optional().describe("Array of {recipient, subject, body}"),
      new_files: z.array(newFileSchema).optional().describe("Array of {filename, folder}"),
      meetings: z.array(meetingSchema).optional().describe("Array of {time, title, topics}"),
      notes: z.string().optional().describe("General notes"),
    },
    async ({
      report_date,
      day_name,
      cobra_updates,
      action_items,
      pending_clarifications,
      mail_drafts,
      new_files,
      meetings,
      notes,
    }) => {
      const report = {
        report_date,
        day_name: day_name || null,
        cobra_updates: cobra_updates || [],
        action_items: action_items || [],
        pending_clarifications: pending_clarifications || [],
        mail_drafts: mail_drafts || [],
        new_files: new_files || [],
        meetings: meetings || [],
        notes: notes || null,
        total_cobra_updates: cobra_updates?.length || 0,
        total_action_items: action_items?.length || 0,
        total_mail_drafts: mail_drafts?.length || 0,
      };

      const { data, error } = await supabase
        .from("daily_reports")
        .upsert(report, { onConflict: "report_date" })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Daily report created/updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "get_daily_report",
    "פרטי סקירה — Get report by date",
    {
      report_date: z.string().describe("Report date (YYYY-MM-DD)"),
    },
    async ({ report_date }) => {
      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("report_date", report_date)
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_daily_reports",
    "רשימת סקירות — List recent reports",
    {
      limit: z.number().default(7).describe("Max results to return"),
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(limit);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_daily_report_item",
    "עדכון פריט בסקירה — Update a specific item in a report",
    {
      id: z.string().uuid().describe("Report UUID"),
      section: z.enum(["action_items", "mail_drafts", "pending_clarifications"]).describe("Section to update"),
      item_index: z.number().int().min(0).describe("0-based index of the item"),
      updates: z.record(z.unknown()).describe("Fields to merge into the item"),
    },
    async ({ id, section, item_index, updates }) => {
      // Fetch current report
      const { data: report, error: fetchError } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) return { content: [{ type: "text" as const, text: `Error fetching report: ${fetchError.message}` }] };

      // Get the array from the section
      const sectionArray = report[section] as Array<Record<string, unknown>>;
      if (!sectionArray || item_index >= sectionArray.length) {
        return { content: [{ type: "text" as const, text: `Invalid item_index for section ${section}` }] };
      }

      // Merge updates into the item
      sectionArray[item_index] = { ...sectionArray[item_index], ...updates };

      // Update the report
      const { data: updated, error: updateError } = await supabase
        .from("daily_reports")
        .update({ [section]: sectionArray })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return { content: [{ type: "text" as const, text: `Error: ${updateError.message}` }] };
      return { content: [{ type: "text" as const, text: `Item updated:\n${JSON.stringify(updated, null, 2)}` }] };
    }
  );

  server.tool(
    "create_tasks_from_report",
    "יצירת משימות מסקירה — Create task instances from a daily report's action items",
    {
      report_id: z.string().uuid().describe("Daily report UUID"),
      assignee_name: z.string().optional().describe("Assignee name for created tasks"),
    },
    async ({ report_id, assignee_name }) => {
      // Fetch the report
      const { data: report, error: reportError } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("id", report_id)
        .single();

      if (reportError) return { content: [{ type: "text" as const, text: `Error fetching report: ${reportError.message}` }] };

      const actionItems = report.action_items as Array<{ text: string; priority: string }>;
      if (!actionItems || actionItems.length === 0) {
        return { content: [{ type: "text" as const, text: "No action items in report" }] };
      }

      // Map priority from report format to task format
      const priorityMap: Record<string, string> = {
        red: "דחוף",
        orange: "גבוה",
        yellow: "בינוני",
      };

      const tasksToCreate = actionItems.map((item) => ({
        title: item.text,
        priority: priorityMap[item.priority] || "בינוני",
        status: "TODO",
        due_date: report.report_date,
        is_daily: true,
        assignee_name,
        notes: `נוצר אוטומטית מסקירת בוקר ${report.report_date}`,
      }));

      const { data: createdTasks, error: createError } = await supabase
        .from("tasks")
        .insert(tasksToCreate)
        .select();

      if (createError) return { content: [{ type: "text" as const, text: `Error creating tasks: ${createError.message}` }] };

      const count = createdTasks?.length || 0;
      return { content: [{ type: "text" as const, text: `Created ${count} tasks from report:\n${JSON.stringify(createdTasks, null, 2)}` }] };
    }
  );
}
