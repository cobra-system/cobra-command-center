import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const BASE44_BASE_URL = "https://base44.app/api/apps";

interface Base44Inspector {
  id: string;
  full_name: string;
}

interface Base44EquipmentItem {
  name: string;
  checked: boolean;
  equipment_id: string;
}

interface Base44Inspection {
  id: string;
  branch_id?: string;
  inspection_date?: string;
  vehicle_number?: string;
  chassis_color?: string;
  manufacturer?: string;
  model?: string;
  owner_name?: string;
  installers?: string[];
  inspector_id?: string;
  status?: string;
  faults?: { description?: string; product?: string; type?: string; handled?: boolean }[];
  preliminary_faults?: string | null;
  requires_detailing?: boolean;
  protection_code?: string;
  equipment_list?: Base44EquipmentItem[];
  created_date?: string;
  // Fields stored for future use, not yet displayed in UI
  protection_provider?: string;
  diagnostics_code?: string;
  diagnostics_report_url?: string;
  is_all_ok?: boolean;
  detailing_window_tint?: boolean;
  detailing_nano_coating?: boolean;
  detailing_ppf_matte?: boolean;
  detailing_ppf_glossy?: boolean;
  detailing_ppf_interior?: boolean;
  detailing_uv_roof?: boolean;
}

interface Base44Equipment {
  id: string;
  name: string;
  category?: string;
  is_active?: boolean;
}

interface SyncConfig {
  app_id: string;
  token: string;
  branch_name: string;
}

async function fetchBase44<T>(appId: string, token: string, entity: string): Promise<T[]> {
  const res = await fetch(`${BASE44_BASE_URL}/${appId}/entities/${entity}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Base44 fetch ${entity} failed: ${res.status}`);
  return res.json() as Promise<T[]>;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function syncApp(
  supabase: ReturnType<typeof createClient>,
  appId: string,
  token: string,
): Promise<{ inspections_synced: number; equipment_rows: number; equipment_types: number }> {
  // 1. Load reference data from Base44
  const [inspectors, equipmentTypes, inspections] = await Promise.all([
    fetchBase44<Base44Inspector>(appId, token, "Inspector"),
    fetchBase44<Base44Equipment>(appId, token, "Equipment"),
    fetchBase44<Base44Inspection>(appId, token, "Inspection"),
  ]);

  const inspectorMap = new Map(inspectors.map((i) => [i.id, i.full_name]));

  // 2. Upsert equipment types → frisbee_product_mapping (insert only, preserve existing mappings)
  const mappingRows = equipmentTypes.map((e) => ({
    base44_equipment_id: e.id,
    base44_equipment_name: e.name,
  }));
  for (const batch of chunk(mappingRows, 200)) {
    await supabase
      .from("frisbee_product_mapping")
      .upsert(batch, { onConflict: "base44_equipment_id", ignoreDuplicates: true });
  }

  // 3. Build inspection rows (includes new fields for future use)
  const inspectionRows = inspections.map((insp) => ({
    base44_id: insp.id,
    base44_branch_id: insp.branch_id || null,
    inspection_date: insp.inspection_date || null,
    vehicle_number: insp.vehicle_number || null,
    chassis_color: insp.chassis_color || null,
    manufacturer: insp.manufacturer || null,
    model: insp.model || null,
    owner_name: insp.owner_name ? insp.owner_name.trim() : null,
    installer_names: insp.installers && insp.installers.length > 0 ? insp.installers : null,
    inspector_name: insp.inspector_id ? (inspectorMap.get(insp.inspector_id) ?? null) : null,
    status: insp.status || null,
    fault_count: insp.faults?.length ?? 0,
    faults: insp.faults && insp.faults.length > 0 ? insp.faults : null,
    preliminary_faults: insp.preliminary_faults || null,
    requires_detailing: insp.requires_detailing ?? false,
    protection_code: insp.protection_code || null,
    synced_at: new Date().toISOString(),
    base44_created_date: insp.created_date || null,
    // New fields — stored now, displayed later
    protection_provider: insp.protection_provider ?? null,
    diagnostics_code: insp.diagnostics_code ?? null,
    diagnostics_report_url: insp.diagnostics_report_url ?? null,
    is_all_ok: insp.is_all_ok ?? null,
    detailing_window_tint: insp.detailing_window_tint ?? null,
    detailing_nano_coating: insp.detailing_nano_coating ?? null,
    detailing_ppf_matte: insp.detailing_ppf_matte ?? null,
    detailing_ppf_glossy: insp.detailing_ppf_glossy ?? null,
    detailing_ppf_interior: insp.detailing_ppf_interior ?? null,
    detailing_uv_roof: insp.detailing_uv_roof ?? null,
  }));

  // 4. Upsert inspections in batches
  let upsertedCount = 0;
  for (const batch of chunk(inspectionRows, 300)) {
    const { error } = await supabase
      .from("frisbee_inspections")
      .upsert(batch, { onConflict: "base44_id" });
    if (error) throw new Error(`Inspection upsert failed: ${error.message}`);
    upsertedCount += batch.length;
  }

  // 5. Rebuild all equipment items (delete-all + batch insert is simpler than diff)
  const allBase44Ids = inspections.map((i) => i.id);
  for (const batch of chunk(allBase44Ids, 500)) {
    await supabase
      .from("frisbee_inspection_equipment")
      .delete()
      .in("base44_inspection_id", batch);
  }

  const equipmentRows: {
    base44_inspection_id: string;
    base44_equipment_id: string;
    equipment_name: string;
    checked: boolean;
  }[] = [];
  for (const insp of inspections) {
    for (const eq of insp.equipment_list ?? []) {
      if (!eq.equipment_id) continue;
      equipmentRows.push({
        base44_inspection_id: insp.id,
        base44_equipment_id: eq.equipment_id,
        equipment_name: eq.name,
        checked: eq.checked,
      });
    }
  }

  for (const batch of chunk(equipmentRows, 500)) {
    const { error } = await supabase.from("frisbee_inspection_equipment").insert(batch);
    if (error) throw new Error(`Equipment insert failed: ${error.message}`);
  }

  return {
    inspections_synced: upsertedCount,
    equipment_rows: equipmentRows.length,
    equipment_types: equipmentTypes.length,
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Enforce a 5-minute minimum interval to avoid hammering the Base44 API
  // and triggering their bot-detection / captcha screens.
  const { limited, retryAfterMs } = checkRateLimit("sync-frisbee:global", 1, 5 * 60_000);
  if (limited) {
    return new Response(
      JSON.stringify({ error: "סנכרון כבר בוצע לאחרונה — יש להמתין לפחות 5 דקות בין סנכרונים", retry_after_seconds: Math.ceil((retryAfterMs ?? 300_000) / 1000) }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(Math.ceil((retryAfterMs ?? 300_000) / 1000)) } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const startMs = Date.now();

  // Resolve which config to use:
  // Priority: (1) request body, (2) env vars, (3) frisbee_sync_config table (first active row)
  let token: string | undefined;
  let appId: string | undefined;

  try {
    const body = await req.clone().json() as Record<string, string>;
    if (body.base44_token) token = body.base44_token;
    if (body.base44_app_id) appId = body.base44_app_id;
  } catch { /* body may be empty */ }

  if (!token) token = Deno.env.get("FRISBEE_BASE44_TOKEN");
  if (!appId) appId = Deno.env.get("FRISBEE_BASE44_APP_ID");

  // Fallback: read from DB config table
  if (!token || !appId) {
    const { data: configs } = await supabase
      .from("frisbee_sync_config")
      .select("app_id, token")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);
    if (configs && configs.length > 0) {
      const cfg = configs[0] as SyncConfig;
      if (!appId) appId = cfg.app_id;
      if (!token) token = cfg.token;
    }
  }

  if (!token || !appId) {
    return new Response(
      JSON.stringify({ error: "אין credentials זמינים — הגדר FRISBEE_BASE44_TOKEN/APP_ID או הוסף שורה ל-frisbee_sync_config" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const result = await syncApp(supabase, appId, token);
    return new Response(
      JSON.stringify({ success: true, ...result, duration_ms: Date.now() - startMs }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
