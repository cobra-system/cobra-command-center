import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerWarehouseLockTools(server: McpServer) {
  server.tool(
    "list_warehouse_locks",
    "בקרת נעילה — List all warehouse locks with current open/closed status.",
    {
      site: z.string().optional().describe("Filter by site (default: cobra-tel-aviv)"),
      active_only: z.boolean().default(true).describe("Return only active locks"),
    },
    async ({ site, active_only }) => {
      let query = supabase
        .from("warehouse_locks")
        .select("*")
        .order("sort_order", { ascending: true });

      if (site) query = query.eq("site", site);
      if (active_only) query = query.eq("active", true);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_warehouse_lock",
    "עדכון מנעול — Update a lock's name, barcode, sort order or active flag.",
    {
      id: z.number().int().describe("Lock id (1-10)"),
      name: z.string().optional(),
      barcode_value: z.string().optional(),
      sort_order: z.number().int().optional(),
      active: z.boolean().optional(),
    },
    async ({ id, ...fields }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) patch[k] = v;
      }

      const { data, error } = await supabase
        .from("warehouse_locks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "set_lock_status",
    "סימון סטטוס מנעול — Manually set a lock to open/closed (also writes a scan log entry).",
    {
      id: z.number().int().describe("Lock id"),
      status: z.enum(["open", "closed"]).describe("Target status"),
      scanned_by: z.string().uuid().optional().describe("User UUID who performed the action"),
      note: z.string().optional().describe("Optional note (recorded as manual scan barcode_value)"),
    },
    async ({ id, status, scanned_by, note }) => {
      const { data: lock, error: fetchError } = await supabase
        .from("warehouse_locks")
        .select("id, barcode_value")
        .eq("id", id)
        .single();
      if (fetchError || !lock) {
        return { content: [{ type: "text" as const, text: `Error: lock ${id} not found` }] };
      }

      const now = new Date().toISOString();
      const action = status === "open" ? "open" : "close";

      const { error: scanError } = await supabase.from("warehouse_lock_scans").insert({
        lock_id: id,
        action,
        scanned_by: scanned_by ?? null,
        barcode_value: note ?? lock.barcode_value,
        method: "manual",
        scanned_at: now,
      });
      if (scanError) return { content: [{ type: "text" as const, text: `Error logging scan: ${scanError.message}` }] };

      const { data, error: updateError } = await supabase
        .from("warehouse_locks")
        .update({
          current_status: status,
          last_scan_at: now,
          last_scan_by: scanned_by ?? null,
          updated_at: now,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return { content: [{ type: "text" as const, text: `Error: ${updateError.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_lock_scan_history",
    "היסטוריית סריקות מנעולים — Query the append-only scan log.",
    {
      lock_id: z.number().int().optional().describe("Filter by lock id"),
      action: z.enum(["open", "close"]).optional(),
      from_date: z.string().optional().describe("ISO date string"),
      limit: z.number().int().default(50),
    },
    async ({ lock_id, action, from_date, limit }) => {
      let query = supabase
        .from("warehouse_lock_scans")
        .select("*")
        .order("scanned_at", { ascending: false })
        .limit(limit);

      if (lock_id !== undefined) query = query.eq("lock_id", lock_id);
      if (action) query = query.eq("action", action);
      if (from_date) query = query.gte("scanned_at", from_date);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "lock_control_summary",
    "סיכום בקרת נעילה — Summary of how many locks are open vs closed for a site.",
    {
      site: z.string().default("cobra-tel-aviv"),
    },
    async ({ site }) => {
      const { data, error } = await supabase
        .from("warehouse_locks")
        .select("id, name, current_status, last_scan_at, last_scan_by")
        .eq("site", site)
        .eq("active", true)
        .order("sort_order");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const total = data?.length ?? 0;
      const closed = data?.filter((l) => l.current_status === "closed").length ?? 0;
      const open = data?.filter((l) => l.current_status === "open").length ?? 0;
      const unknown = total - closed - open;

      const summary = {
        site,
        total,
        closed,
        open,
        unknown,
        closed_pct: total === 0 ? 0 : Math.round((closed / total) * 100),
        open_pct: total === 0 ? 0 : Math.round((open / total) * 100),
        locks: data,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );
}
