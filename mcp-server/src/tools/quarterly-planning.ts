import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

const DIVISION_ENUM = z.enum(["דלק מוטורס", "פריזבי קרסו", "לובינסקי"]);

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(error: { message: string }) {
  return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
}

export function registerQuarterlyPlanningTools(server: McpServer) {
  // ═══════════════════════════════════════════════════════════════
  // Vehicle Models — דגמי רכב
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_vehicle_models",
    "דגמי רכב — List vehicle models. Filter by division, brand, model_family, is_active.",
    {
      division: DIVISION_ENUM.optional().describe("Filter by division"),
      brand: z.string().optional().describe("Filter by brand (e.g. 'Renault', 'Nissan')"),
      model_family: z.string().optional().describe("Filter by model family (e.g. 'קשקאי')"),
      is_active: z.boolean().optional().describe("Filter by active status"),
    },
    async ({ division, brand, model_family, is_active }) => {
      let query = supabase
        .from("vehicle_models")
        .select("*")
        .order("division")
        .order("brand")
        .order("model_family")
        .order("model_name");

      if (division) query = query.eq("division", division);
      if (brand) query = query.eq("brand", brand);
      if (model_family) query = query.eq("model_family", model_family);
      if (is_active !== undefined) query = query.eq("is_active", is_active);

      const { data, error } = await query;
      return error ? err(error) : ok(data);
    }
  );

  server.tool(
    "upsert_vehicle_model",
    "עדכון דגם רכב — Create or update a vehicle model.",
    {
      id: z.string().uuid().optional().describe("Existing model UUID (omit to create)"),
      division: DIVISION_ENUM.describe("Division name"),
      brand: z.string().describe("Brand: 'Renault' | 'Nissan' | 'Dacia' | 'Chery' | 'Xpeng' etc."),
      model_name: z.string().describe("Full model name, e.g. 'Qashqai III CVT 2X4 M-Hyb 1.3T-ACENTA'"),
      model_family: z.string().optional().describe("Hebrew group name for aggregation, e.g. 'קשקאי'"),
      segment: z.string().optional().describe("'Exhibition_Room' | 'National_Marketing'"),
      model_code: z.string().optional().describe("Importer model code, e.g. '331_9'"),
      is_active: z.boolean().optional().describe("Whether the model is currently active"),
    },
    async ({ id, division, brand, model_name, model_family, segment, model_code, is_active }) => {
      const payload: Record<string, unknown> = {
        division,
        brand,
        model_name,
        updated_at: new Date().toISOString(),
      };
      if (id) payload.id = id;
      if (model_family !== undefined) payload.model_family = model_family;
      if (segment !== undefined) payload.segment = segment;
      if (model_code !== undefined) payload.model_code = model_code;
      if (is_active !== undefined) payload.is_active = is_active;

      const { data, error } = await supabase
        .from("vehicle_models")
        .upsert(payload, { onConflict: "division,model_name,segment" })
        .select()
        .single();

      return error ? err(error) : ok(data);
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Quarterly Vehicle Forecasts — תחזיות רבעוניות
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_quarterly_forecasts",
    "תחזיות רבעוניות — List quarterly vehicle forecasts with model details. Filter by division, year, quarter.",
    {
      division: DIVISION_ENUM.optional().describe("Filter by division (via vehicle_models join)"),
      year: z.number().int().optional().describe("Filter by year (e.g. 2026)"),
      quarter: z.number().int().min(1).max(4).optional().describe("Filter by quarter (1-4)"),
      vehicle_model_id: z.string().uuid().optional().describe("Filter by specific model"),
    },
    async ({ division, year, quarter, vehicle_model_id }) => {
      let query = supabase
        .from("quarterly_vehicle_forecasts")
        .select(`
          id, vehicle_model_id, year, quarter,
          month1_qty, month2_qty, month3_qty, total_qty,
          notes, created_at, updated_at,
          vehicle_models(id, division, brand, model_name, model_family, segment, model_code)
        `)
        .order("year", { ascending: false })
        .order("quarter", { ascending: false });

      if (vehicle_model_id) query = query.eq("vehicle_model_id", vehicle_model_id);
      if (year) query = query.eq("year", year);
      if (quarter) query = query.eq("quarter", quarter);
      if (division) query = query.eq("vehicle_models.division", division);

      const { data, error } = await query;
      if (error) return err(error);
      const filtered = division
        ? (data ?? []).filter((r: Record<string, unknown>) => r.vehicle_models !== null)
        : data;
      return ok(filtered);
    }
  );

  server.tool(
    "upsert_quarterly_forecast",
    "עדכון תחזית רבעונית — Create or update monthly quantities for a model+quarter.",
    {
      vehicle_model_id: z.string().uuid().describe("Vehicle model UUID"),
      year: z.number().int().describe("Year (e.g. 2026)"),
      quarter: z.number().int().min(1).max(4).describe("Quarter (1-4)"),
      month1_qty: z.number().int().min(0).describe("First month quantity"),
      month2_qty: z.number().int().min(0).describe("Second month quantity"),
      month3_qty: z.number().int().min(0).describe("Third month quantity"),
      notes: z.string().optional().describe("Free-text notes"),
    },
    async ({ vehicle_model_id, year, quarter, month1_qty, month2_qty, month3_qty, notes }) => {
      const payload: Record<string, unknown> = {
        vehicle_model_id,
        year,
        quarter,
        month1_qty,
        month2_qty,
        month3_qty,
        updated_at: new Date().toISOString(),
      };
      if (notes !== undefined) payload.notes = notes;

      const { data, error } = await supabase
        .from("quarterly_vehicle_forecasts")
        .upsert(payload, { onConflict: "vehicle_model_id,year,quarter" })
        .select()
        .single();

      return error ? err(error) : ok(data);
    }
  );

  server.tool(
    "bulk_import_forecasts",
    "ייבוא תחזיות — Bulk import vehicle models and forecasts for a division+quarter.",
    {
      division: DIVISION_ENUM.describe("Division name"),
      year: z.number().int().describe("Year"),
      quarter: z.number().int().min(1).max(4).describe("Quarter (1-4)"),
      rows: z.array(z.object({
        brand: z.string(),
        model_name: z.string(),
        model_family: z.string().optional(),
        segment: z.string().optional(),
        model_code: z.string().optional(),
        month1_qty: z.number().int().min(0),
        month2_qty: z.number().int().min(0),
        month3_qty: z.number().int().min(0),
      })).describe("Array of model rows with quantities"),
    },
    async ({ division, year, quarter, rows }) => {
      const results: unknown[] = [];
      for (const row of rows) {
        const { data: model, error: modelErr } = await supabase
          .from("vehicle_models")
          .upsert({
            division,
            brand: row.brand,
            model_name: row.model_name,
            model_family: row.model_family ?? null,
            segment: row.segment ?? null,
            model_code: row.model_code ?? null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "division,model_name,segment" })
          .select("id")
          .single();

        if (modelErr) {
          results.push({ model_name: row.model_name, error: modelErr.message });
          continue;
        }

        const { data: forecast, error: fErr } = await supabase
          .from("quarterly_vehicle_forecasts")
          .upsert({
            vehicle_model_id: model.id,
            year,
            quarter,
            month1_qty: row.month1_qty,
            month2_qty: row.month2_qty,
            month3_qty: row.month3_qty,
            updated_at: new Date().toISOString(),
          }, { onConflict: "vehicle_model_id,year,quarter" })
          .select()
          .single();

        results.push(fErr ? { model_name: row.model_name, error: fErr.message } : forecast);
      }
      return ok({ imported: results.length, results });
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Product-Model Mappings — מיפוי מוצרים לדגמים
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_product_model_mappings",
    "מיפוי מוצרים — List product-to-model-family mappings. Filter by division, product_id, model_family.",
    {
      division: DIVISION_ENUM.optional().describe("Filter by division"),
      product_id: z.string().uuid().optional().describe("Filter by product UUID"),
      model_family: z.string().optional().describe("Filter by model family"),
    },
    async ({ division, product_id, model_family }) => {
      let query = supabase
        .from("product_model_mappings")
        .select(`
          id, division, product_id, model_family, utilization_pct, notes,
          created_at, updated_at,
          products(id, name, sku)
        `)
        .order("division")
        .order("model_family");

      if (division) query = query.eq("division", division);
      if (product_id) query = query.eq("product_id", product_id);
      if (model_family) query = query.eq("model_family", model_family);

      const { data, error } = await query;
      return error ? err(error) : ok(data);
    }
  );

  server.tool(
    "upsert_product_model_mapping",
    "עדכון מיפוי — Create or update a product-to-model-family mapping with utilization %.",
    {
      division: DIVISION_ENUM.describe("Division name"),
      product_id: z.string().uuid().describe("Product UUID"),
      model_family: z.string().describe("Model family name (e.g. 'קשקאי')"),
      utilization_pct: z.number().min(0).max(1).describe("Utilization percentage (0.0-1.0)"),
      notes: z.string().optional().describe("Free-text notes"),
    },
    async ({ division, product_id, model_family, utilization_pct, notes }) => {
      const payload: Record<string, unknown> = {
        division,
        product_id,
        model_family,
        utilization_pct,
        updated_at: new Date().toISOString(),
      };
      if (notes !== undefined) payload.notes = notes;

      const { data, error } = await supabase
        .from("product_model_mappings")
        .upsert(payload, { onConflict: "division,product_id,model_family" })
        .select()
        .single();

      return error ? err(error) : ok(data);
    }
  );

  server.tool(
    "delete_product_model_mapping",
    "מחיקת מיפוי — Remove a product-model mapping by id.",
    {
      id: z.string().uuid().describe("Mapping record UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("product_model_mappings")
        .delete()
        .eq("id", id);

      return error ? err(error) : ok({ deleted: true, id });
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Quarterly Procurement Plans — תוכניות רכש רבעוניות
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_quarterly_procurement_plans",
    "תוכניות רכש — List quarterly procurement plans. Filter by division, year, quarter.",
    {
      division: DIVISION_ENUM.optional().describe("Filter by division"),
      year: z.number().int().optional().describe("Filter by year"),
      quarter: z.number().int().min(1).max(4).optional().describe("Filter by quarter (1-4)"),
      product_id: z.string().uuid().optional().describe("Filter by product UUID"),
    },
    async ({ division, year, quarter, product_id }) => {
      let query = supabase
        .from("quarterly_procurement_plans")
        .select(`
          *,
          products(id, name, sku, supplier)
        `)
        .order("division")
        .order("year", { ascending: false })
        .order("quarter", { ascending: false });

      if (division) query = query.eq("division", division);
      if (year) query = query.eq("year", year);
      if (quarter) query = query.eq("quarter", quarter);
      if (product_id) query = query.eq("product_id", product_id);

      const { data, error } = await query;
      return error ? err(error) : ok(data);
    }
  );

  server.tool(
    "upsert_quarterly_procurement_plan",
    "עדכון תוכנית רכש — Create or update a procurement plan row for a product+quarter.",
    {
      division: DIVISION_ENUM.describe("Division name"),
      product_id: z.string().uuid().describe("Product UUID"),
      year: z.number().int().describe("Year"),
      quarter: z.number().int().min(1).max(4).describe("Quarter (1-4)"),
      computed_forecast: z.number().int().optional(),
      manual_forecast_override: z.number().int().optional(),
      utilization_pct: z.number().optional(),
      safety_buffer: z.number().optional(),
      smoothed_required: z.number().optional(),
      current_stock: z.number().int().optional(),
      incoming_orders: z.number().int().optional(),
      required_to_order: z.number().optional(),
      month1_demand: z.number().optional(),
      month2_demand: z.number().optional(),
      month3_demand: z.number().optional(),
      order_execution_date: z.string().optional(),
      payment_status: z.string().optional(),
      actual_ordered_qty: z.number().int().optional(),
      shipping_type: z.string().optional(),
      estimated_arrival_date: z.string().optional(),
      incoming_arrival_date: z.string().optional(),
      notes: z.string().optional(),
    },
    async (params) => {
      const { division, product_id, year, quarter, ...rest } = params;
      const payload: Record<string, unknown> = {
        division,
        product_id,
        year,
        quarter,
        updated_at: new Date().toISOString(),
      };
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) payload[k] = v;
      }

      const { data, error } = await supabase
        .from("quarterly_procurement_plans")
        .upsert(payload, { onConflict: "division,product_id,year,quarter" })
        .select()
        .single();

      return error ? err(error) : ok(data);
    }
  );

  server.tool(
    "recalculate_procurement_plan",
    "חישוב מחדש — Recalculate procurement plan for all products of a division+quarter based on vehicle forecasts and product-model mappings.",
    {
      division: DIVISION_ENUM.describe("Division name"),
      year: z.number().int().describe("Year"),
      quarter: z.number().int().min(1).max(4).describe("Quarter (1-4)"),
    },
    async ({ division, year, quarter }) => {
      const { data: mappings, error: mapErr } = await supabase
        .from("product_model_mappings")
        .select("product_id, model_family, utilization_pct")
        .eq("division", division);
      if (mapErr) return err(mapErr);

      const { data: forecasts, error: fcErr } = await supabase
        .from("quarterly_vehicle_forecasts")
        .select("vehicle_model_id, total_qty, vehicle_models!inner(division, model_family)")
        .eq("year", year)
        .eq("quarter", quarter)
        .eq("vehicle_models.division", division);
      if (fcErr) return err(fcErr);

      const familyTotals = new Map<string, number>();
      for (const f of forecasts ?? []) {
        const vm = f.vehicle_models as unknown as { model_family: string };
        if (!vm?.model_family) continue;
        familyTotals.set(vm.model_family, (familyTotals.get(vm.model_family) ?? 0) + (f.total_qty ?? 0));
      }

      const { data: divProds, error: dpErr } = await supabase
        .from("division_products")
        .select("product_id, division_stock")
        .eq("division", division);
      if (dpErr) return err(dpErr);

      const stockMap = new Map<string, number>();
      for (const dp of divProds ?? []) {
        stockMap.set(dp.product_id, dp.division_stock ?? 0);
      }

      const productForecasts = new Map<string, { forecast: number; utilization: number; count: number }>();
      for (const m of mappings ?? []) {
        const familyQty = familyTotals.get(m.model_family) ?? 0;
        const entry = productForecasts.get(m.product_id) ?? { forecast: 0, utilization: 0, count: 0 };
        entry.forecast += familyQty;
        entry.utilization += m.utilization_pct;
        entry.count += 1;
        productForecasts.set(m.product_id, entry);
      }

      const results: unknown[] = [];
      for (const [productId, entry] of productForecasts) {
        const avgUtil = entry.count > 0 ? entry.utilization / entry.count : 1;
        const forecast = entry.forecast;
        const safetyBuffer = 1.2;
        const smoothed = Math.ceil(forecast * avgUtil * safetyBuffer);
        const stock = stockMap.get(productId) ?? 0;
        const toOrder = Math.max(0, smoothed - stock);

        const { data, error } = await supabase
          .from("quarterly_procurement_plans")
          .upsert({
            division,
            product_id: productId,
            year,
            quarter,
            computed_forecast: forecast,
            utilization_pct: avgUtil,
            safety_buffer: safetyBuffer,
            smoothed_required: smoothed,
            current_stock: stock,
            required_to_order: toOrder,
            month1_demand: Math.ceil(toOrder * 0.5),
            month2_demand: Math.ceil(toOrder * 0.25),
            month3_demand: toOrder - Math.ceil(toOrder * 0.5) - Math.ceil(toOrder * 0.25),
            updated_at: new Date().toISOString(),
          }, { onConflict: "division,product_id,year,quarter" })
          .select()
          .single();

        results.push(error ? { product_id: productId, error: error.message } : data);
      }

      return ok({ recalculated: results.length, results });
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Quarterly Plan Snapshots — צילומי תכנון רכש
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_quarterly_plan_snapshots",
    "צילומי תכנון רכש — List quarterly plan snapshots. Filter by division, year, quarter.",
    {
      division: DIVISION_ENUM.optional().describe("Filter by division"),
      year: z.number().int().optional().describe("Filter by year"),
      quarter: z.number().int().min(1).max(4).optional().describe("Filter by quarter (1-4)"),
    },
    async ({ division, year, quarter }) => {
      let query = supabase
        .from("quarterly_plan_snapshots")
        .select("id,division,year,quarter,label,notes,total_products,total_required,captured_at,captured_by_name")
        .order("captured_at", { ascending: false });
      if (division) query = query.eq("division", division);
      if (year) query = query.eq("year", year);
      if (quarter) query = query.eq("quarter", quarter);
      const { data, error } = await query;
      return error ? err(error) : ok(data);
    }
  );

  server.tool(
    "restore_quarterly_plan_snapshot",
    "שחזור צילום — Restore a quarterly plan snapshot, overwriting current plans with snapshot payload.",
    {
      snapshot_id: z.string().uuid().describe("ID of the snapshot to restore"),
    },
    async ({ snapshot_id }) => {
      const { data: snap, error: fetchErr } = await supabase
        .from("quarterly_plan_snapshots")
        .select("*")
        .eq("id", snapshot_id)
        .single();
      if (fetchErr || !snap) return err(fetchErr ?? { message: "Snapshot not found" });

      const payload = snap.payload as Record<string, unknown>[];
      const rows = payload.map((p: Record<string, unknown>) => ({
        division: p.division,
        product_id: p.product_id,
        year: p.year,
        quarter: p.quarter,
        computed_forecast: p.computed_forecast,
        manual_forecast_override: p.manual_forecast_override,
        utilization_pct: p.utilization_pct,
        safety_buffer: p.safety_buffer,
        smoothed_required: p.smoothed_required,
        current_stock: p.current_stock,
        incoming_orders: p.incoming_orders,
        required_to_order: p.required_to_order,
        month1_demand: p.month1_demand,
        month2_demand: p.month2_demand,
        month3_demand: p.month3_demand,
        order_execution_date: p.order_execution_date,
        payment_status: p.payment_status,
        actual_ordered_qty: p.actual_ordered_qty,
        shipping_type: p.shipping_type,
        estimated_arrival_date: p.estimated_arrival_date,
        incoming_arrival_date: p.incoming_arrival_date,
        notes: p.notes,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("quarterly_procurement_plans")
        .upsert(rows, { onConflict: "division,product_id,year,quarter" });
      return error ? err(error) : ok({ restored: rows.length, snapshot_label: snap.label });
    }
  );
}
