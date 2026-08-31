import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { unwrapRows } from "../lib/queryResult.js";

export function registerReminderTools(server: McpServer) {
  server.tool(
    "create_follow_up",
    "יצירת תזכורת מעקב — Schedule a follow-up task for an order, supplier, or issue",
    {
      title: z.string().describe("Follow-up title"),
      description: z.string().optional().describe("Details about what to follow up on"),
      due_date: z.string().describe("Follow-up date (YYYY-MM-DD)"),
      assignee_name: z.string().optional().describe("Person responsible"),
      priority: z.enum(["P0", "P1", "P2", "P3"]).default("P2").describe("Priority level"),
      related_entity_type: z.enum(["order", "supplier", "product", "issue", "compliance", "general"]).optional()
        .describe("Type of related entity"),
      related_entity_id: z.string().uuid().optional().describe("UUID of the related entity"),
    },
    async ({ title, description, due_date, assignee_name, priority, related_entity_type, related_entity_id }) => {
      const notes = [
        description || "",
        related_entity_type ? `[${related_entity_type}:${related_entity_id || "N/A"}]` : "",
      ].filter(Boolean).join("\n");

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title,
          description: notes || null,
          due_date,
          assignee_name: assignee_name || null,
          priority,
          status: "TODO",
          is_daily: false,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Follow-up created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_pending_follow_ups",
    "תזכורות ממתינות — List follow-ups and tasks that need attention today",
    {
      date: z.string().optional().describe("Date to check (YYYY-MM-DD, defaults to today)"),
      assignee_name: z.string().optional().describe("Filter by assignee"),
      include_overdue: z.boolean().default(true).describe("Include overdue items from past dates"),
    },
    async ({ date, assignee_name, include_overdue }) => {
      const targetDate = date || new Date().toISOString().split("T")[0];

      let query = supabase
        .from("tasks")
        .select("id, title, description, due_date, assignee_name, priority, status")
        .neq("status", "TEMPLATE")
        .neq("status", "DONE")
        .order("priority")
        .order("due_date");

      if (include_overdue) {
        query = query.lte("due_date", targetDate);
      } else {
        query = query.eq("due_date", targetDate);
      }

      if (assignee_name) query = query.ilike("assignee_name", `%${assignee_name}%`);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const tasks = data || [];
      const overdue = tasks.filter((t: Record<string, unknown>) => (t.due_date as string) < targetDate);
      const today = tasks.filter((t: Record<string, unknown>) => (t.due_date as string) === targetDate);

      const result = {
        date: targetDate,
        total: tasks.length,
        overdue: { count: overdue.length, items: overdue },
        today: { count: today.length, items: today },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "auto_generate_daily_report",
    "יצירת סקירת בוקר אוטומטית — Build a daily report from current system data",
    {
      report_date: z.string().optional().describe("Report date (YYYY-MM-DD, defaults to today)"),
    },
    async ({ report_date }) => {
      const date = report_date || new Date().toISOString().split("T")[0];
      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [ordersRes, tasksRes, complianceRes, paymentsRes, issuesRes] = await Promise.all([
        // Active orders with upcoming ETAs
        supabase.from("orders").select("id, supplier_name, status, eta, priority, notes")
          .not("status", "in", '("הושלמה","בוטלה")').order("eta"),
        // Tasks due today or overdue
        supabase.from("tasks").select("id, title, due_date, assignee_name, priority, status")
          .neq("status", "TEMPLATE").neq("status", "DONE").lte("due_date", date).order("priority"),
        // Compliance expiring soon
        supabase.from("compliance_items").select("id, name, expiry_date, renewal_contact")
          .eq("status", "active").lte("expiry_date", sevenDays).order("expiry_date"),
        // Pending payments
        supabase.from("supplier_payments").select("id, amount, currency, due_date, supplier_id, suppliers(company)")
          .in("status", ["ממתין", "pending"]).lte("due_date", sevenDays).order("due_date"),
        // Open critical issues
        supabase.from("product_issues").select("id, description, severity, product_id")
          .neq("status", "נסגר").in("severity", ["קריטי", "גבוה"]),
      ]);

      const orders = unwrapRows(ordersRes, "orders");
      const tasks = unwrapRows(tasksRes, "tasks");
      const compliance = unwrapRows(complianceRes, "compliance");
      const payments = unwrapRows(paymentsRes, "payments");
      const issues = unwrapRows(issuesRes, "issues");

      // Build COBRA updates from active orders
      const cobraUpdates = orders.slice(0, 10).map((o: Record<string, unknown>) => ({
        order_name: `${o.supplier_name} - ${o.status}`,
        description: `ETA: ${o.eta || "לא ידוע"} | עדיפות: ${o.priority}${o.notes ? ` | ${o.notes}` : ""}`,
      }));

      // Build action items from tasks
      const actionItems = tasks.slice(0, 15).map((t: Record<string, unknown>) => {
        const priorityMap: Record<string, string> = { P0: "red", P1: "red", "דחוף": "red", P2: "orange", "גבוה": "orange", P3: "yellow", "בינוני": "yellow" };
        return {
          text: `${t.title}${t.assignee_name ? ` (${t.assignee_name})` : ""}`,
          priority: priorityMap[t.priority as string] || "yellow",
          done: false,
        };
      });

      // Build pending clarifications from compliance and issues
      const pendingClarifications = [
        ...compliance.map((c: Record<string, unknown>) => ({
          supplier: c.renewal_contact || "צוות ציות",
          issue: `${c.name} - פג תוקף ${c.expiry_date}`,
        })),
        ...issues.slice(0, 5).map((i: Record<string, unknown>) => ({
          supplier: "צוות איכות",
          issue: `${i.description} (${i.severity})`,
        })),
      ];

      // Build mail drafts from pending payments
      const mailDrafts = payments.slice(0, 5).map((p: Record<string, unknown>) => ({
        recipient: ((p.suppliers as Record<string, unknown>)?.company as string) || "ספק",
        subject: `תשלום ממתין - ${p.amount} ${p.currency}`,
        body: `שלום, תשלום בסך ${p.amount} ${p.currency} ממתין לתאריך ${p.due_date}. נא לאשר.`,
        status: "draft",
      }));

      // Save to daily_reports
      const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
      const dayName = dayNames[new Date(date).getDay()];

      const report = {
        report_date: date,
        day_name: dayName,
        cobra_updates: cobraUpdates,
        action_items: actionItems,
        pending_clarifications: pendingClarifications,
        mail_drafts: mailDrafts,
        new_files: [],
        meetings: [],
        notes: `דוח שנוצר אוטומטית | ${orders.length} הזמנות פתוחות | ${tasks.length} משימות ממתינות | ${compliance.length} פריטי ציות מתפוגגים`,
        total_cobra_updates: cobraUpdates.length,
        total_action_items: actionItems.length,
        total_mail_drafts: mailDrafts.length,
      };

      const { data: savedReport, error: saveError } = await supabase
        .from("daily_reports")
        .upsert(report, { onConflict: "report_date" })
        .select()
        .single();

      if (saveError) return { content: [{ type: "text" as const, text: `Error saving report: ${saveError.message}` }] };
      return { content: [{ type: "text" as const, text: `Auto-generated daily report:\n${JSON.stringify(savedReport, null, 2)}` }] };
    }
  );
}
