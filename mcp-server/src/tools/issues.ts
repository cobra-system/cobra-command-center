import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerIssueTools(server: McpServer) {
  server.tool(
    "list_issues",
    "רשימת תקלות — List product issues, optionally filtered by status/severity/product",
    {
      status: z.enum(["פתוח", "בטיפול", "נסגר"]).optional().describe("Filter by status: פתוח (open), בטיפול (in progress), נסגר (closed)"),
      severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).optional().describe("Filter by severity: נמוך (low), בינוני (medium), גבוה (high), קריטי (critical)"),
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
      severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).default("בינוני").describe("Severity: נמוך (low), בינוני (medium), גבוה (high), קריטי (critical)"),
      reporter: z.string().default("Claude").describe("Who reported this issue"),
      status: z.enum(["פתוח", "בטיפול", "נסגר"]).default("פתוח").describe("Status: פתוח (open), בטיפול (in progress), נסגר (closed)"),
      ticket_number: z.string().optional().describe("External ticket number (e.g. iStar)"),
      diagnostic_source: z.enum(["app", "device"]).optional().describe("Source of the issue"),
      image_url: z.string().optional().describe("URL of an image showing the issue"),
      diagnostic_steps: z.string().optional().describe("JSON string of diagnostic steps array, e.g. '[\"step1\",\"step2\"]'"),
    },
    async ({ product_id, description, severity, reporter, status, ticket_number, diagnostic_source, image_url, diagnostic_steps }) => {
      let parsedSteps = null;
      if (diagnostic_steps) {
        try { parsedSteps = JSON.parse(diagnostic_steps); } catch { parsedSteps = null; }
      }
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
          image_url: image_url || null,
          diagnostic_steps: parsedSteps,
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
      status: z.enum(["פתוח", "בטיפול", "נסגר"]).optional().describe("New status: פתוח (open), בטיפול (in progress), נסגר (closed)"),
      severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).optional().describe("New severity: נמוך (low), בינוני (medium), גבוה (high), קריטי (critical)"),
      resolution: z.string().optional().describe("Resolution description (when closing)"),
      ticket_number: z.string().optional().describe("External ticket number"),
      image_url: z.string().optional().describe("URL of an image showing the issue"),
      diagnostic_steps: z.string().optional().describe("JSON string of diagnostic steps array"),
    },
    async ({ id, status, severity, resolution, ticket_number, image_url, diagnostic_steps }) => {
      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (severity) updates.severity = severity;
      if (resolution) updates.resolution = resolution;
      if (ticket_number) updates.ticket_number = ticket_number;
      if (image_url) updates.image_url = image_url;
      if (diagnostic_steps) { try { updates.diagnostic_steps = JSON.parse(diagnostic_steps); } catch { /* skip invalid JSON */ } }
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

  server.tool(
    "delete_issue",
    "מחיקת תקלה — Delete a product issue by ID",
    {
      id: z.string().uuid().describe("Issue UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("product_issues")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Issue deleted successfully` }] };
    }
  );

  server.tool(
    "summarize_issues",
    "סיכום תקלות — Dashboard summary: counts by status and severity, list of open high-priority issues",
    {
      product_id: z.string().uuid().optional().describe("Limit summary to a specific product UUID"),
    },
    async ({ product_id }) => {
      let query = supabase
        .from("product_issues")
        .select("id, status, severity, product_id, description, reported_date, reporter");
      if (product_id) query = query.eq("product_id", product_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const issues = data || [];
      const byStatus: Record<string, number> = { "פתוח": 0, "בטיפול": 0, "נסגר": 0 };
      const bySeverity: Record<string, number> = { "נמוך": 0, "בינוני": 0, "גבוה": 0, "קריטי": 0 };

      for (const i of issues) {
        if (i.status in byStatus) byStatus[i.status]++;
        if (i.severity in bySeverity) bySeverity[i.severity]++;
      }

      const openHighPriority = issues
        .filter(i => i.status === "פתוח" && (i.severity === "קריטי" || i.severity === "גבוה"))
        .sort((a, b) => new Date(b.reported_date).getTime() - new Date(a.reported_date).getTime())
        .slice(0, 10);

      const summary = {
        total: issues.length,
        by_status: byStatus,
        by_severity: bySeverity,
        open_high_priority: openHighPriority,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    "search_issues",
    "חיפוש תקלות — Search issues by description text, reporter name, product name, or date range",
    {
      text: z.string().optional().describe("Free-text search in description"),
      reporter: z.string().optional().describe("Reporter name (partial match)"),
      product_name: z.string().optional().describe("Product name (partial match) — resolves to product IDs automatically"),
      status: z.enum(["פתוח", "בטיפול", "נסגר"]).optional().describe("Filter by status"),
      severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).optional().describe("Filter by severity"),
      from_date: z.string().optional().describe("Start date (YYYY-MM-DD inclusive)"),
      to_date: z.string().optional().describe("End date (YYYY-MM-DD inclusive)"),
      limit: z.number().default(50).describe("Max results to return"),
    },
    async ({ text, reporter, product_name, status, severity, from_date, to_date, limit }) => {
      let productIds: string[] | null = null;
      if (product_name) {
        const { data: prods, error: pErr } = await supabase
          .from("products")
          .select("id")
          .ilike("name", `%${product_name}%`);
        if (pErr) return { content: [{ type: "text" as const, text: `Error fetching products: ${pErr.message}` }] };
        productIds = (prods || []).map((p: { id: string }) => p.id);
        if (productIds.length === 0) return { content: [{ type: "text" as const, text: JSON.stringify([], null, 2) }] };
      }

      let query = supabase
        .from("product_issues")
        .select("*")
        .order("reported_date", { ascending: false })
        .limit(limit);

      if (text) query = query.ilike("description", `%${text}%`);
      if (reporter) query = query.ilike("reporter", `%${reporter}%`);
      if (status) query = query.eq("status", status);
      if (severity) query = query.eq("severity", severity);
      if (from_date) query = query.gte("reported_date", from_date);
      if (to_date) query = query.lte("reported_date", to_date);
      if (productIds) query = query.in("product_id", productIds);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "close_issue",
    "סגירת תקלה — Close an issue with a required resolution description (sets resolved_date automatically)",
    {
      id: z.string().uuid().describe("Issue UUID"),
      resolution: z.string().describe("What was done to resolve this issue"),
    },
    async ({ id, resolution }) => {
      const { data, error } = await supabase
        .from("product_issues")
        .update({
          status: "נסגר",
          resolution,
          resolved_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Issue closed:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "bulk_update_issues",
    "עדכון מרובה תקלות — Update status or severity for multiple issues matching a filter (e.g. close all open issues for a product)",
    {
      product_id: z.string().uuid().optional().describe("Filter: only issues for this product UUID"),
      current_status: z.enum(["פתוח", "בטיפול", "נסגר"]).optional().describe("Filter: only issues with this current status"),
      current_severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).optional().describe("Filter: only issues with this severity"),
      new_status: z.enum(["פתוח", "בטיפול", "נסגר"]).optional().describe("New status to apply to matched issues"),
      new_severity: z.enum(["נמוך", "בינוני", "גבוה", "קריטי"]).optional().describe("New severity to apply to matched issues"),
      resolution: z.string().optional().describe("Resolution text (required when new_status is נסגר)"),
    },
    async ({ product_id, current_status, current_severity, new_status, new_severity, resolution }) => {
      if (!new_status && !new_severity) {
        return { content: [{ type: "text" as const, text: "Error: at least one of new_status or new_severity must be provided" }] };
      }
      if (!product_id && !current_status && !current_severity) {
        return { content: [{ type: "text" as const, text: "Error: at least one filter (product_id, current_status, or current_severity) must be provided to prevent unintended bulk updates" }] };
      }

      const updates: Record<string, unknown> = {};
      if (new_status) updates.status = new_status;
      if (new_severity) updates.severity = new_severity;
      if (resolution) updates.resolution = resolution;
      if (new_status === "נסגר") updates.resolved_date = new Date().toISOString().split("T")[0];

      const matchFilter: Record<string, string> = {};
      if (product_id) matchFilter.product_id = product_id;
      if (current_status) matchFilter.status = current_status;
      if (current_severity) matchFilter.severity = current_severity;

      const { data, error } = await supabase
        .from("product_issues")
        .update(updates)
        .match(matchFilter)
        .select("id, product_id, status, severity");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Updated ${(data || []).length} issue(s):\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "get_issue_with_context",
    "פרטי תקלה עם הקשר — Get issue enriched with product name, type, and supplier contact details",
    {
      id: z.string().uuid().describe("Issue UUID"),
    },
    async ({ id }) => {
      const { data: issue, error: iErr } = await supabase
        .from("product_issues")
        .select("*")
        .eq("id", id)
        .single();

      if (iErr) return { content: [{ type: "text" as const, text: `Error: ${iErr.message}` }] };

      const { data: product } = await supabase
        .from("products")
        .select("id, name, product_type, supplier")
        .eq("id", issue.product_id)
        .maybeSingle();

      let supplier = null;
      if (product?.supplier) {
        const { data: byId } = await supabase
          .from("suppliers")
          .select("id, company, contact_name, email")
          .eq("id", product.supplier)
          .maybeSingle();
        if (byId) {
          supplier = byId;
        } else {
          const { data: byName } = await supabase
            .from("suppliers")
            .select("id, company, contact_name, email")
            .eq("company", product.supplier)
            .maybeSingle();
          supplier = byName;
        }
      }

      const result = {
        ...issue,
        product_name: product?.name ?? null,
        product_type: product?.product_type ?? null,
        supplier_company: supplier?.company ?? null,
        supplier_contact: supplier?.contact_name ?? null,
        supplier_email: supplier?.email ?? null,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Issue Updates (Comments) — עדכונים / הערות על תקלה
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_issue_updates",
    "הערות תקלה — List comments/updates posted on an issue",
    {
      issue_id: z.string().uuid().describe("Issue UUID"),
    },
    async ({ issue_id }) => {
      const { data, error } = await supabase
        .from("issue_updates")
        .select("*")
        .eq("issue_id", issue_id)
        .order("created_at", { ascending: true });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_issue_update",
    "הוספת הערה לתקלה — Post a comment/update to an issue",
    {
      issue_id: z.string().uuid().describe("Issue UUID"),
      content: z.string().describe("Update text / comment body"),
      author_name: z.string().optional().describe("Author display name"),
      user_id: z.string().uuid().optional().describe("Author user UUID"),
    },
    async ({ issue_id, content, author_name, user_id }) => {
      const { data, error } = await supabase
        .from("issue_updates")
        .insert({
          issue_id,
          content,
          author_name: author_name ?? null,
          user_id: user_id ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_issue_update",
    "מחיקת הערה מתקלה — Delete a comment from an issue",
    {
      id: z.string().uuid().describe("issue_updates record UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("issue_updates")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: id }) }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Issue Attachments (Media) — קבצים מצורפים לתקלה
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_issue_attachments",
    "קבצים מצורפים לתקלה — List media attachments (images/videos) for an issue",
    {
      issue_id: z.string().uuid().describe("Issue UUID"),
    },
    async ({ issue_id }) => {
      const { data, error } = await supabase
        .from("issue_attachments")
        .select("*")
        .eq("issue_id", issue_id)
        .order("created_at", { ascending: true });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_issue_attachment",
    "הוספת קובץ מצורף לתקלה — Attach a media file (image or video) to an issue",
    {
      issue_id: z.string().uuid().describe("Issue UUID"),
      file_url: z.string().describe("Public URL of the uploaded file"),
      file_type: z.enum(["image", "video"]).describe("Media type"),
      file_name: z.string().optional().describe("Original file name"),
      created_by: z.string().uuid().optional().describe("Uploader user UUID"),
    },
    async ({ issue_id, file_url, file_type, file_name, created_by }) => {
      const { data, error } = await supabase
        .from("issue_attachments")
        .insert({
          issue_id,
          file_url,
          file_type,
          file_name: file_name ?? null,
          created_by: created_by ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_issue_attachment",
    "מחיקת קובץ מצורף מתקלה — Delete a media attachment from an issue",
    {
      id: z.string().uuid().describe("issue_attachments record UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("issue_attachments")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: id }) }] };
    }
  );
}
