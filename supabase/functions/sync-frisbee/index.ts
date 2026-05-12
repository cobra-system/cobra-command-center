import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

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
}

interface Base44Equipment {
  id: string;
  name: string;
  category?: string;
  is_active?: boolean;
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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let token = Deno.env.get("FRISBEE_BASE44_TOKEN");
  let appId = Deno.env.get("FRISBEE_BASE44_APP_ID");
  // Allow passing credentials in the request body as a fallback (useful before secrets are set)
  try {
    const body = await req.clone().json() as Record<string, string>;
    if (!token && body.base44_token) token = body.base44_token;
    if (!appId && body.base44_app_id) appId = body.base44_app_id;
  } catch { /* body may be empty */ }
  if (!token || !appId) {
    return new Response(
      JSON.stringify({ error: "FRISBEE_BASE44_TOKEN / FRISBEE_BASE44_APP_ID לא מוגדרים" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const startMs = Date.now();

  try {
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

    // 3. Build inspection rows
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
    // Delete in batches to avoid row limits
    const allBase44Ids = inspections.map((i) => i.id);
    for (const batch of chunk(allBase44Ids, 500)) {
      await supabase
        .from("frisbee_inspection_equipment")
        .delete()
        .in("base44_inspection_id", batch);
    }

    // Build flat equipment rows
    const equipmentRows: {
      base44_inspection_id: string;
      base44_equipment_id: string;
      equipment_name: string;
      checked: boolean;
    }[] = [];
    for (const insp of inspections) {
      for (const eq of insp.equipment_list ?? []) {
        if (!eq.equipment_id) continue; // skip malformed rows
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

    return new Response(
      JSON.stringify({
        success: true,
        inspections_synced: upsertedCount,
        equipment_rows: equipmentRows.length,
        equipment_types: equipmentTypes.length,
        duration_ms: Date.now() - startMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
