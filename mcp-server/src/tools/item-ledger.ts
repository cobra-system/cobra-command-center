import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import {
  analyzeLedger, buildNotes, computePlan, SERVICE_LEVELS, type AnalysisMovement,
} from "../lib/itemLedgerAnalyze.js";

/**
 * Item ledger (כרטסת פריט) — the ERP item-movement export, uploaded monthly
 * from the products page ("ייבוא כרטסת").
 *
 * Tables: item_ledger_imports, item_ledger_items, item_ledger_movements.
 * Consumption = תמ + ימ − הח/חז; transfers (מח), supplier receipts (קנ/מר)
 * and supplier returns (הר/זר) move stock but are not consumption.
 */

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (message: string) => text(`Error: ${message}`);
const PAGE = 1000;

async function loadMovements(sku: string) {
  const out: AnalysisMovement[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("item_ledger_movements")
      .select("movement_date, line_no, doc_type, warehouse_code, account_code, account_name, quantity")
      .eq("sku", sku)
      .order("movement_date", { ascending: true })
      .order("line_no", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []).map(r => ({ ...r, quantity: Number(r.quantity) })) as AnalysisMovement[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export function registerItemLedgerTools(server: McpServer) {
  server.tool(
    "list_item_ledger_imports",
    "רשימת טעינות כרטסת — List uploaded item-ledger (כרטסת פריטים) files, newest first",
    { limit: z.number().int().min(1).max(100).default(20).describe("Max rows") },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from("item_ledger_imports")
        .select("id, file_name, period_start, period_end, item_count, movement_count, unmatched_skus, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return fail(error.message);
      return text(JSON.stringify(data, null, 2));
    }
  );

  server.tool(
    "list_item_ledger_items",
    "פריטים בכרטסת — List SKUs that have ledger history: covered period, opening/closing balance, linked product. Use stale_days to find items whose ledger is out of date.",
    {
      search: z.string().optional().describe("Filter by SKU or item name (partial)"),
      stale_days: z.number().int().optional().describe("Only items whose last movement date is older than this many days"),
      unmatched_only: z.boolean().default(false).describe("Only SKUs with no matching product in Cobra"),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ search, stale_days, unmatched_only, limit }) => {
      let q = supabase
        .from("item_ledger_items")
        .select("sku, item_name, product_id, period_start, period_end, opening_balance, closing_balance, updated_at")
        .order("sku")
        .limit(limit);
      if (search) q = q.or(`sku.ilike.%${search}%,item_name.ilike.%${search}%`);
      if (unmatched_only) q = q.is("product_id", null);
      if (stale_days != null) {
        const cutoff = new Date(Date.now() - stale_days * 86_400_000).toISOString().slice(0, 10);
        q = q.lt("period_end", cutoff);
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return text(JSON.stringify(data, null, 2));
    }
  );

  server.tool(
    "list_item_ledger_movements",
    "תנועות כרטסת — Raw movement lines of one SKU from the item ledger, filterable by date, document type and warehouse",
    {
      sku: z.string().describe("Exact SKU"),
      date_from: z.string().optional().describe("YYYY-MM-DD"),
      date_to: z.string().optional().describe("YYYY-MM-DD"),
      doc_type: z.string().optional().describe("Document type prefix, e.g. תמ, מח, קנ, מר, הר, כמ"),
      warehouse_code: z.string().optional().describe("ERP warehouse code, e.g. 001, 011, 100"),
      limit: z.number().int().min(1).max(1000).default(200),
    },
    async ({ sku, date_from, date_to, doc_type, warehouse_code, limit }) => {
      let q = supabase
        .from("item_ledger_movements")
        .select("movement_date, doc_type, doc_number, doc_line, warehouse_code, account_code, account_name, quantity, unit_price, balance")
        .eq("sku", sku.trim().toUpperCase())
        .order("movement_date", { ascending: true })
        .order("line_no", { ascending: true })
        .limit(limit);
      if (date_from) q = q.gte("movement_date", date_from);
      if (date_to) q = q.lte("movement_date", date_to);
      if (doc_type) q = q.eq("doc_type", doc_type);
      if (warehouse_code) q = q.eq("warehouse_code", warehouse_code);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return text(JSON.stringify(data, null, 2));
    }
  );

  server.tool(
    "get_item_ledger_analysis",
    "ניתוח כרטסת פריט — Consumption & reorder analysis of one SKU from its item ledger: net consumption, weekly mean/median/σ, monthly table, top customer share, receipts, per-warehouse flow, reorder point/order-up-to and things to check before ordering. Same numbers as the product page.",
    {
      sku: z.string().describe("Exact SKU"),
      rate: z.enum(["all", "w26", "w13", "w4"]).optional().describe("Planning rate window (default: 26 weeks when available, else whole period)"),
      lead_time_weeks: z.number().min(0.5).max(52).optional().describe("Supplier lead time in weeks (default: product.lead_time_days / 7, else 4)"),
      review_weeks: z.number().min(1).max(26).default(4).describe("How often an order is placed, in weeks"),
      service_level: z.enum(["90%", "92.5%", "95%", "97%", "99%"]).default("95%"),
      stock_override: z.number().optional().describe("Physically available stock, if different from the ledger closing balance"),
      include_weeks: z.boolean().default(false).describe("Include the weekly demand/balance series"),
    },
    async ({ sku, rate, lead_time_weeks, review_weeks, service_level, stock_override, include_weeks }) => {
      const key = sku.trim().toUpperCase();
      const { data: item, error } = await supabase
        .from("item_ledger_items")
        .select("sku, item_name, product_id, period_start, period_end, opening_balance, closing_balance, updated_at")
        .eq("sku", key)
        .maybeSingle();
      if (error) return fail(error.message);
      if (!item) return fail(`No ledger history for SKU ${key}. Upload the item ledger from the products page (ייבוא כרטסת).`);

      let movements: AnalysisMovement[];
      try { movements = await loadMovements(key); } catch (e) { return fail((e as Error).message); }

      let product: { name: string; stock_qty: number | null; lead_time_days: number | null } | null = null;
      if (item.product_id) {
        const { data } = await supabase.from("products").select("name, stock_qty, lead_time_days").eq("id", item.product_id).maybeSingle();
        product = data;
      }
      const { data: centers } = await supabase.from("distribution_centers").select("name, sap_code").is("deleted_at", null);
      const whNames: Record<string, string> = { "100": "מחסן שירות", ...Object.fromEntries((centers ?? []).filter(c => c.sap_code).map(c => [c.sap_code, c.name])) };
      const warehouseName = (code: string) => (whNames[code] ? `${whNames[code]} (${code})` : `מחסן ${code}`);

      const a = analyzeLedger({
        movements,
        opening_balance: Number(item.opening_balance),
        closing_balance: Number(item.closing_balance),
        period_start: item.period_start,
        period_end: item.period_end,
      });
      const rateOpt = a.rates.find(r => r.key === (rate ?? a.defaultRateKey)) ?? a.rates[0];
      const L = lead_time_weeks ?? (product?.lead_time_days ? product.lead_time_days / 7 : 4);
      const z = SERVICE_LEVELS.find(s => s.label === service_level)!.z;
      const stock = stock_override ?? a.closingBalance;
      const plan = computePlan({ rate: rateOpt.rate, sd: a.weeklySd, leadWeeks: L, reviewWeeks: review_weeks, z, stock });

      const result = {
        sku: item.sku,
        item_name: item.item_name,
        product: product?.name ?? null,
        period: { start: item.period_start, end: item.period_end, analysis_start: a.analysisStart, is_launch: a.isLaunch },
        consumption: {
          net: a.netConsumption, shipped: a.shipped, returned: a.returned,
          return_rate: +a.returnRate.toFixed(3),
          weekly_mean: +a.weeklyMean.toFixed(2), weekly_median: a.weeklyMedian, weekly_sd: +a.weeklySd.toFixed(2),
          full_weeks: a.fullWeekCount, monthly_rate: +a.monthlyRate.toFixed(1), annual_rate: Math.round(a.annualRate),
        },
        rates: a.rates,
        top_customers: a.customers.slice(0, 8).map(c => ({ ...c, share: +c.share.toFixed(3) })),
        months: a.months,
        doc_types: a.docTypes,
        receipts: a.receipts,
        warehouses: a.warehouses.map(w => ({ ...w, name: warehouseName(w.code) })),
        balance: { opening: Number(item.opening_balance), closing: a.closingBalance, low_point: a.minBalance, cover_weeks: a.coverWeeks && +a.coverWeeks.toFixed(1) },
        plan: { rate: rateOpt, lead_time_weeks: L, review_weeks, service_level, stock, ...plan },
        notes: buildNotes(a, { periodEnd: item.period_end, today: new Date().toISOString().slice(0, 10), systemStock: product?.stock_qty ?? null, warehouseName }),
        ...(include_weeks ? { weeks: a.weeks } : {}),
      };
      return text(JSON.stringify(result, null, 2));
    }
  );
}
