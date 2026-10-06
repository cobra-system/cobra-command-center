import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LedgerItem } from "@/lib/itemLedger/parse";
import type { AnalysisMovement } from "@/lib/itemLedger/analyze";

export interface ItemLedgerSummary {
  sku: string;
  item_name: string | null;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  updated_at: string;
}

// Warehouses outside distribution_centers that still show up in the ERP export
const EXTRA_WAREHOUSES: Record<string, string> = { "100": "מחסן שירות" };

const PAGE = 1000;

async function fetchLedger(sku: string) {
  const { data: item, error } = await supabase
    .from("item_ledger_items")
    .select("sku, item_name, period_start, period_end, opening_balance, closing_balance, updated_at")
    .eq("sku", sku)
    .maybeSingle();
  if (error) throw error;
  if (!item) return null;

  // PostgREST caps a response at 1,000 rows — page through the history
  const movements: AnalysisMovement[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error: mErr } = await supabase
      .from("item_ledger_movements")
      .select("movement_date, line_no, doc_type, warehouse_code, account_code, account_name, quantity")
      .eq("sku", sku)
      .order("movement_date", { ascending: true })
      .order("line_no", { ascending: true })
      .range(from, from + PAGE - 1);
    if (mErr) throw mErr;
    movements.push(...((data ?? []) as AnalysisMovement[]));
    if (!data || data.length < PAGE) break;
  }
  return { item: item as ItemLedgerSummary, movements };
}

export function useItemLedger(sku: string | null | undefined) {
  const key = sku?.trim().toUpperCase() || "";
  return useQuery({
    queryKey: ["item-ledger", key],
    queryFn: () => fetchLedger(key),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });
}

export interface WarehouseInfo { name: string | null; division: string | null }

const EXTRA_WAREHOUSE_DIVISION: Record<string, string> = { "100": "שירות" };

// Installers carry the ERP warehouse number as an integer ("032" → 32)
const installerKey = (code: string) => String(parseInt(code, 10));

/**
 * Resolves an ERP warehouse code to its name and division:
 *  1. distribution_centers.sap_code (central + bonded warehouses; division falls back to the center name)
 *  2. installers.warehouse_number (the field warehouses listed on each division page)
 */
export function useWarehouseNames() {
  const { data } = useQuery({
    queryKey: ["warehouse-names-v2"],
    queryFn: async () => {
      const [centers, installers] = await Promise.all([
        supabase.from("distribution_centers").select("name, division, sap_code").is("deleted_at", null).not("sap_code", "is", null),
        supabase.from("installers").select("name, warehouse_number, division").is("deleted_at", null).not("warehouse_number", "is", null),
      ]);
      if (centers.error) throw centers.error;
      if (installers.error) throw installers.error;

      const byCenter = new Map<string, WarehouseInfo>();
      for (const c of centers.data ?? []) {
        byCenter.set(c.sap_code as string, { name: c.name as string, division: ((c.division as string | null) ?? (c.name as string)) });
      }
      const byInstaller = new Map<string, { names: string[]; divisions: Set<string> }>();
      for (const i of installers.data ?? []) {
        const k = String(i.warehouse_number);
        const e = byInstaller.get(k) ?? { names: [], divisions: new Set<string>() };
        e.names.push(i.name as string);
        if (i.division) e.divisions.add(i.division as string);
        byInstaller.set(k, e);
      }
      return { byCenter, byInstaller };
    },
    staleTime: 30 * 60_000,
  });

  const info = (code: string): WarehouseInfo => {
    const center = data?.byCenter.get(code);
    if (center) return center;
    const inst = data?.byInstaller.get(installerKey(code));
    if (inst) return { name: inst.names.join(" / "), division: [...inst.divisions].join(" / ") || null };
    const extra = EXTRA_WAREHOUSES[code];
    return extra ? { name: extra, division: EXTRA_WAREHOUSE_DIVISION[code] ?? null } : { name: null, division: null };
  };

  const warehouseName = (code: string) => {
    const { name } = info(code);
    return name ? `${name} (${code})` : `מחסן ${code}`;
  };
  return Object.assign(warehouseName, { info });
}

export function useItemLedgerImports(limit = 6) {
  return useQuery({
    queryKey: ["item-ledger-imports", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_ledger_imports")
        .select("id, file_name, period_start, period_end, item_count, movement_count, unmatched_skus, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface ImportProgress { done: number; total: number }

/**
 * Upload one parsed ledger file. Items are sent to the import_item_ledger RPC
 * in small batches — each batch replaces the SKUs' movements inside the file's
 * period atomically.
 */
export async function importLedgerFile(
  fileName: string,
  parsed: { items: LedgerItem[]; period_start: string | null; period_end: string | null; movement_count: number },
  productIdBySku: Map<string, string>,
  onProgress?: (p: ImportProgress) => void,
) {
  if (!parsed.period_start || !parsed.period_end) throw new Error("לא נמצאו תנועות עם תאריך בקובץ");
  const unmatched = parsed.items.filter(i => !productIdBySku.has(i.sku)).map(i => i.sku);

  const { data: imp, error } = await supabase
    .from("item_ledger_imports")
    .insert({
      file_name: fileName,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      item_count: parsed.items.length,
      movement_count: parsed.movement_count,
      unmatched_skus: unmatched,
    })
    .select("id")
    .single();
  if (error) throw error;

  const BATCH_ROWS = 4000;
  let batch: LedgerItem[] = [];
  let rows = 0;
  let done = 0;
  const flush = async () => {
    if (!batch.length) return;
    const payload = batch.map(i => ({
      sku: i.sku,
      item_name: i.item_name,
      product_id: productIdBySku.get(i.sku) ?? null,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      opening_balance: i.opening_balance,
      closing_balance: i.closing_balance,
      movements: i.movements,
    }));
    const { error: rpcErr } = await supabase.rpc("import_item_ledger", { p_import_id: imp.id, p_items: payload });
    if (rpcErr) throw rpcErr;
    done += batch.length;
    onProgress?.({ done, total: parsed.items.length });
    batch = [];
    rows = 0;
  };
  for (const item of parsed.items) {
    batch.push(item);
    rows += item.movements.length + 1;
    if (rows >= BATCH_ROWS || batch.length >= 50) await flush();
  }
  await flush();
  return { importId: imp.id as string, unmatched };
}

export function useInvalidateItemLedger() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["item-ledger"] });
    qc.invalidateQueries({ queryKey: ["item-ledger-imports"] });
  };
}
