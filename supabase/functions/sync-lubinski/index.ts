import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

// Fixed branch identifier used for all Lubinski inspections in the shared frisbee tables
const LUBINSKI_BRANCH_ID = "lubinski";

// Maps Lubinski boolean API fields → synthetic equipment IDs + display names.
// These IDs are pre-populated in frisbee_product_mapping by migration 20260513000001.
const BOOL_EQUIPMENT: { field: string; id: string; name: string }[] = [
  { field: "tow_hook_fixed",          id: "lub-tow-hook-fixed",          name: "וו גרירה קבוע" },
  { field: "tow_hook_retractable",    id: "lub-tow-hook-retractable",    name: "וו גרירה משתחרר" },
  { field: "detailing_window_tint",   id: "lub-detailing-window-tint",   name: "חילון" },
  { field: "detailing_uv_roof",       id: "lub-detailing-uv-roof",       name: "UV גג" },
  { field: "detailing_nano_coating",  id: "lub-detailing-nano-coating",  name: "ציפוי נאנו" },
  { field: "detailing_nano_interior", id: "lub-detailing-nano-interior", name: "נאנו פנים" },
  { field: "detailing_ppf_matte",     id: "lub-detailing-ppf-matte",     name: "PPF מאט" },
  { field: "detailing_ppf_glossy",    id: "lub-detailing-ppf-glossy",    name: "PPF גלוסי" },
];

interface LubinskiInspection {
  id?: string;
  _id?: string;
  vehicle_number?: string;
  inspection_date?: string;
  branch_id?: string;
  status?: string;
  requires_detailing?: boolean;
  tow_hook_fixed?: boolean;
  tow_hook_retractable?: boolean;
  detailing_window_tint?: boolean;
  detailing_uv_roof?: boolean;
  detailing_nano_coating?: boolean;
  detailing_nano_interior?: boolean;
  detailing_ppf_matte?: boolean;
  detailing_ppf_glossy?: boolean;
  // equipment_list may be a structured array or a plain string list
  equipment_list?: unknown;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function runSync(
  supabase: ReturnType<typeof createClient>,
  apiUrl: string,
  apiKey: string,
): Promise<{ inspections_synced: number; equipment_rows: number }> {
  const url = `${apiUrl}/Inspection?fields=vehicle_number,equipment_list,tow_hook_fixed,tow_hook_retractable,requires_detailing,detailing_window_tint,detailing_uv_roof,detailing_nano_coating,detailing_nano_interior,detailing_ppf_matte,detailing_ppf_glossy,inspection_date,branch_id,status`;

  const res = await fetch(url, { headers: { "api_key": apiKey, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Lubinski API fetch failed: ${res.status} ${await res.text()}`);

  const inspections = await res.json() as LubinskiInspection[];

  // Build inspection rows
  const inspectionRows = inspections.map((insp) => {
    const base44Id = String(insp.id ?? insp._id ?? `lub-${insp.vehicle_number}-${insp.inspection_date}`);
    return {
      base44_id:             base44Id,
      base44_branch_id:      LUBINSKI_BRANCH_ID,
      inspection_date:       insp.inspection_date ?? null,
      vehicle_number:        insp.vehicle_number ?? null,
      status:                insp.status ?? null,
      requires_detailing:    insp.requires_detailing ?? false,
      fault_count:           0,
      synced_at:             new Date().toISOString(),
      // Store raw boolean accessory fields for future reference
      tow_hook_fixed:        insp.tow_hook_fixed ?? null,
      tow_hook_retractable:  insp.tow_hook_retractable ?? null,
      detailing_window_tint:   insp.detailing_window_tint ?? null,
      detailing_uv_roof:       insp.detailing_uv_roof ?? null,
      detailing_nano_coating:  insp.detailing_nano_coating ?? null,
      detailing_nano_interior: insp.detailing_nano_interior ?? null,
      detailing_ppf_matte:     insp.detailing_ppf_matte ?? null,
      detailing_ppf_glossy:    insp.detailing_ppf_glossy ?? null,
    };
  });

  let upsertedCount = 0;
  for (const batch of chunk(inspectionRows, 300)) {
    const { error } = await supabase
      .from("frisbee_inspections")
      .upsert(batch, { onConflict: "base44_id" });
    if (error) throw new Error(`Inspection upsert failed: ${error.message}`);
    upsertedCount += batch.length;
  }

  // Rebuild equipment items for all synced inspections
  const allBase44Ids = inspections.map((i) => String(i.id ?? i._id ?? `lub-${i.vehicle_number}-${i.inspection_date}`));
  for (const batch of chunk(allBase44Ids, 500)) {
    await supabase.from("frisbee_inspection_equipment").delete().in("base44_inspection_id", batch);
  }

  const equipmentRows: { base44_inspection_id: string; base44_equipment_id: string; equipment_name: string; checked: boolean }[] = [];

  for (const insp of inspections) {
    const base44Id = String(insp.id ?? insp._id ?? `lub-${insp.vehicle_number}-${insp.inspection_date}`);

    // 1. Boolean fields → equipment rows
    for (const eq of BOOL_EQUIPMENT) {
      const val = (insp as Record<string, unknown>)[eq.field];
      equipmentRows.push({
        base44_inspection_id: base44Id,
        base44_equipment_id:  eq.id,
        equipment_name:       eq.name,
        checked:              val === true,
      });
    }

    // 2. equipment_list — handle structured [{name, checked?, id?}] or string[]
    const list = insp.equipment_list;
    if (Array.isArray(list)) {
      for (const item of list) {
        if (typeof item === "string") {
          equipmentRows.push({
            base44_inspection_id: base44Id,
            base44_equipment_id:  `lub-list-${item}`,
            equipment_name:       item,
            checked:              true,
          });
        } else if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const name = String(obj.name ?? obj.equipment_name ?? "");
          const eqId = String(obj.equipment_id ?? obj.id ?? `lub-list-${name}`);
          if (name) {
            equipmentRows.push({
              base44_inspection_id: base44Id,
              base44_equipment_id:  eqId,
              equipment_name:       name,
              checked:              obj.checked !== false,
            });
          }
        }
      }
    }
  }

  for (const batch of chunk(equipmentRows, 500)) {
    const { error } = await supabase.from("frisbee_inspection_equipment").insert(batch);
    if (error) throw new Error(`Equipment insert failed: ${error.message}`);
  }

  return { inspections_synced: upsertedCount, equipment_rows: equipmentRows.length };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Enforce a 5-minute minimum interval to avoid hammering the external API
  // and triggering bot-detection / captcha screens.
  const { limited, retryAfterMs } = checkRateLimit("sync-lubinski:global", 1, 5 * 60_000);
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

  // Read config from DB (frisbee_sync_config where branch_name = 'לובינסקי')
  const { data: configs } = await supabase
    .from("frisbee_sync_config")
    .select("api_url, api_key_value")
    .eq("branch_name", "לובינסקי")
    .eq("is_active", true)
    .limit(1);

  const cfg = configs?.[0] as { api_url: string | null; api_key_value: string | null } | undefined;
  const apiUrl = cfg?.api_url ?? Deno.env.get("LUBINSKI_API_URL");
  const apiKey = cfg?.api_key_value ?? Deno.env.get("LUBINSKI_API_KEY");

  if (!apiUrl || !apiKey) {
    return new Response(
      JSON.stringify({ error: "אין credentials — הוסף שורה ל-frisbee_sync_config עם branch_name=לובינסקי" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const result = await runSync(supabase, apiUrl, apiKey);
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
