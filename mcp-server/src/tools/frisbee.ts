import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ljpdwezgahrrffnwajho.supabase.co";
const SYNC_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/sync-frisbee`;

export function registerFrisbeeTools(server: McpServer) {
  server.tool(
    "sync_frisbee_data",
    "סינכרון נתוני בדיקות QA מ-Base44 לסופה‑בייס — Sync Frisbee QA inspection data from Base44 into Supabase. Fetches all inspections, equipment items, and inspector names.",
    {},
    async () => {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
      const body: Record<string, string> = {};
      if (process.env.FRISBEE_BASE44_TOKEN) body.base44_token = process.env.FRISBEE_BASE44_TOKEN;
      if (process.env.FRISBEE_BASE44_APP_ID) body.base44_app_id = process.env.FRISBEE_BASE44_APP_ID;
      const res = await fetch(SYNC_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) return { content: [{ type: "text" as const, text: `Sync failed: ${JSON.stringify(json)}` }] };
      return {
        content: [{
          type: "text" as const,
          text: `✅ Sync complete\n• Inspections: ${json.inspections_synced}\n• Equipment rows: ${json.equipment_rows}\n• Equipment types: ${json.equipment_types}\n• Duration: ${json.duration_ms}ms`,
        }],
      };
    }
  );

  server.tool(
    "get_frisbee_consumption",
    "צריכת אביזרים — Equipment consumption stats from synced Base44 inspection data. Shows how many times each accessory was installed (checked=true) across completed inspections.",
    {
      branch: z.enum(["פריזבי", "דלק מוטורס", "all"]).default("פריזבי").describe("Branch to filter by"),
      date_from: z.string().optional().describe("Start date YYYY-MM-DD"),
      date_to: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async ({ branch, date_from, date_to }) => {
      const branchIdMap: Record<string, string> = {
        "פריזבי": "68fa0cbd274acbfa7b159523",
      };

      let query = supabase
        .from("frisbee_inspection_equipment")
        .select(`
          base44_equipment_id,
          equipment_name,
          checked,
          frisbee_inspections!inner (
            base44_id,
            base44_branch_id,
            inspection_date,
            status
          ),
          frisbee_product_mapping (
            product_id,
            display_name,
            products (name, sku)
          )
        `)
        .eq("frisbee_inspections.status", "completed");

      if (branch !== "all") {
        query = query.eq("frisbee_inspections.base44_branch_id", branchIdMap[branch]);
      }
      if (date_from) query = query.gte("frisbee_inspections.inspection_date", date_from);
      if (date_to) query = query.lte("frisbee_inspections.inspection_date", date_to);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // Aggregate by equipment
      const agg = new Map<string, {
        name: string; installed: number; total: number;
        product_name?: string; product_sku?: string; product_id?: string;
      }>();

      // Count unique inspection IDs for total
      const inspectionIds = new Set<string>();
      (data ?? []).forEach((row: Record<string, unknown>) => {
        const insp = row.frisbee_inspections as Record<string, unknown>;
        if (insp?.base44_id) inspectionIds.add(insp.base44_id as string);
        const eqId = row.base44_equipment_id as string;
        if (!agg.has(eqId)) {
          const mapping = row.frisbee_product_mapping as Record<string, unknown> | null;
          const product = mapping?.products as Record<string, unknown> | null;
          agg.set(eqId, {
            name: row.equipment_name as string,
            installed: 0,
            total: 0,
            product_name: (product?.name as string) || (mapping?.display_name as string) || undefined,
            product_sku: (product?.sku as string) || undefined,
            product_id: (mapping?.product_id as string) || undefined,
          });
        }
        const entry = agg.get(eqId)!;
        entry.total++;
        if (row.checked) entry.installed++;
      });

      const totalInspections = inspectionIds.size;
      const rows = [...agg.values()]
        .sort((a, b) => b.installed - a.installed)
        .map((r) => ({
          equipment: r.name,
          installed: r.installed,
          pct: totalInspections > 0 ? Math.round(r.installed / totalInspections * 100) : 0,
          product: r.product_name ? `${r.product_sku ? r.product_sku + " · " : ""}${r.product_name}` : "לא ממופה",
        }));

      const lines = [
        `📊 צריכת אביזרים — ${branch} (${totalInspections} בדיקות)`,
        "",
        ...rows.map((r) => `${r.installed.toString().padStart(4)}x (${r.pct.toString().padStart(3)}%)  ${r.equipment}${r.product !== "לא ממופה" ? `  →  ${r.product}` : ""}`),
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "get_frisbee_inspections",
    "רשימת בדיקות QA — List Frisbee QA inspection records with optional filters.",
    {
      branch: z.enum(["פריזבי", "דלק מוטורס", "all"]).default("פריזבי"),
      date_from: z.string().optional().describe("Start date YYYY-MM-DD"),
      date_to: z.string().optional().describe("End date YYYY-MM-DD"),
      installer_name: z.string().optional().describe("Filter by installer name (partial match)"),
      has_faults: z.boolean().optional().describe("Filter to only inspections with faults"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ branch, date_from, date_to, installer_name, has_faults, limit }) => {
      const branchIdMap: Record<string, string> = {
        "פריזבי": "68fa0cbd274acbfa7b159523",
      };

      let query = supabase
        .from("frisbee_inspections")
        .select("base44_id, inspection_date, vehicle_number, manufacturer, model, owner_name, installer_names, inspector_name, status, fault_count, requires_detailing")
        .eq("status", "completed")
        .order("inspection_date", { ascending: false })
        .limit(limit);

      if (branch !== "all") query = query.eq("base44_branch_id", branchIdMap[branch]);
      if (date_from) query = query.gte("inspection_date", date_from);
      if (date_to) query = query.lte("inspection_date", date_to);
      if (has_faults === true) query = query.gt("fault_count", 0);
      if (has_faults === false) query = query.eq("fault_count", 0);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // Filter by installer name client-side (array contains)
      const filtered = installer_name
        ? (data ?? []).filter((r) =>
            (r.installer_names ?? []).some((n: string) =>
              n.toLowerCase().includes(installer_name.toLowerCase())
            )
          )
        : (data ?? []);

      if (filtered.length === 0) {
        return { content: [{ type: "text" as const, text: "לא נמצאו בדיקות עבור הפילטרים שהוזנו." }] };
      }

      const lines = filtered.map((r) => {
        const date = r.inspection_date ? r.inspection_date.slice(0, 10) : "—";
        const installers = (r.installer_names ?? []).join(", ") || "—";
        const faults = r.fault_count > 0 ? ` ⚠️ ${r.fault_count} ליקויים` : "";
        const detailing = r.requires_detailing ? " 🎨 גימור" : "";
        return `${date}  ${r.vehicle_number ?? "—"}  ${r.manufacturer ?? ""} ${r.model ?? ""}  ${r.owner_name ?? "—"}  [${installers}]${faults}${detailing}`;
      });

      return { content: [{ type: "text" as const, text: `נמצאו ${filtered.length} בדיקות:\n\n${lines.join("\n")}` }] };
    }
  );

  server.tool(
    "update_frisbee_product_mapping",
    "מיפוי אביזר Base44 למוצר — Map a Base44 equipment ID to one of our internal products. Use this to link e.g. 'PROOF' → our Z4K PROOF product.",
    {
      base44_equipment_id: z.string().describe("The Base44 equipment ID to map"),
      product_id: z.string().uuid().nullable().describe("Our internal product UUID (null to unmap)"),
      display_name: z.string().optional().describe("Optional display name override"),
    },
    async ({ base44_equipment_id, product_id, display_name }) => {
      const updates: Record<string, unknown> = { product_id };
      if (display_name !== undefined) updates.display_name = display_name;

      const { data, error } = await supabase
        .from("frisbee_product_mapping")
        .update(updates)
        .eq("base44_equipment_id", base44_equipment_id)
        .select("base44_equipment_name, product_id, display_name")
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return {
        content: [{
          type: "text" as const,
          text: `✅ Mapped "${data.base44_equipment_name}" → product_id: ${data.product_id ?? "null"}${data.display_name ? ` (display: ${data.display_name})` : ""}`,
        }],
      };
    }
  );

  server.tool(
    "list_frisbee_product_mappings",
    "רשימת מיפויי אביזרים — List all Base44 equipment types and their mapping status to our products.",
    {},
    async () => {
      const { data, error } = await supabase
        .from("frisbee_product_mapping")
        .select("base44_equipment_id, base44_equipment_name, product_id, display_name, products(name, sku)")
        .order("base44_equipment_name");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const mapped = (data ?? []).filter((r) => r.product_id);
      const unmapped = (data ?? []).filter((r) => !r.product_id);

      const fmt = (r: Record<string, unknown>) => {
        const product = r.products as Record<string, unknown> | null;
        const productStr = product ? `${product.sku} · ${product.name}` : r.display_name ?? "—";
        return `  ${r.base44_equipment_id}  ${r.base44_equipment_name}  →  ${productStr}`;
      };

      const lines = [
        `✅ ממופה (${mapped.length}):`,
        ...mapped.map(fmt),
        "",
        `❌ לא ממופה (${unmapped.length}):`,
        ...unmapped.map((r) => `  ${r.base44_equipment_id}  ${r.base44_equipment_name}`),
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
