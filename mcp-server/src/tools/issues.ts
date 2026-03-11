import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerIssueTools(server: McpServer) {
  server.tool(
    "list_issues",
    "רשימת תקלות — List product issues, optionally filtered by status/severity/product",
    {
      status: z.enum(["פתוח", "בטיפול", "נסגר"]).optional().describe("Filter by status"),
      severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).optional().describe("Filter by severity"),
      product_id: z.string().uuid().optional().describe("Filter by product UUID"),
      limit: z.number().default(50).describe("Max results to return"),
    },
    async ({ status, severity, product_id, limit }) => {
      let query = supabase
        .from("product_issues")
        .select("*")
        .order("reported_date", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (severity) query = query.eq("severity", severity);
      if (product_id) query = query.eq("product_id", product_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_issue",
    "פרטי תקלה — Get a single product issue by ID",
    {
      id: z.string().uuid().describe("Issue UUID"),
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("product_issues")
        .select("*")
        .eq("id", id)
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_issue",
    "יצירת תקלה חדשה למוצר — Create a new product issue",
    {
      product_id: z.string().uuid().describe("UUID of the product"),
      description: z.string().describe("Issue description"),
      severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).default("בינוני").describe("Severity level"),
      reporter: z.string().default("Claude").describe("Who reported this issue"),
      status: z.enum(["פתוח", "בטיפול", "נסגר"]).default("פתוח").describe("Issue status"),
      ticket_number: z.string().optional().describe("External ticket number (e.g. iStar)"),
      diagnostic_source: z.enum(["app", "device"]).optional().describe("Source of the issue"),
    },
    async ({ product_id, description, severity, reporter, status, ticket_number, diagnostic_source }) => {
      const { data, error } = await supabase
        .from("product_issues")
        .insert({
          product_id,
          description,
          severity,
          reporter,
          status,
          ticket_number: ticket_number || null,
          diagnostic_source: diagnostic_source || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Issue created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_issue",
    "עדכון תקלה — Update an existing product issue (status, resolution, severity, etc.)",
    {
      id: z.string().uuid().describe("Issue UUID"),
      status: z.enum(["פתוח", "בטיפול", "נסגר"]).optional().describe("New status"),
      severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).optional().describe("New severity"),
      resolution: z.string().optional().describe("Resolution description (when closing)"),
      ticket_number: z.string().optional().describe("External ticket number"),
    },
    async ({ id, status, severity, resolution, ticket_number }) => {
      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (severity) updates.severity = severity;
      if (resolution) updates.resolution = resolution;
      if (ticket_number) updates.ticket_number = ticket_number;
      if (status === "נסגר") updates.resolved_date = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("product_issues")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Issue updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );
}
