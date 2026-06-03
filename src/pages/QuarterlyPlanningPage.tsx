import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { InlineEditCell } from "@/components/orders/InlineEditCell";
import { InlineSelectCell } from "@/components/orders/InlineSelectCell";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { BONDED_DIVISIONS } from "@/components/equipment/constants";
import type {
  VehicleModel,
  QuarterlyVehicleForecast,
  ProductModelMapping,
  QuarterlyProcurementPlan,
} from "@/contexts/types";
import {
  Calendar, Package, TrendingUp, ShoppingCart, Upload,
  Plus, RefreshCw, Download, Search, X, ChevronDown, ChevronUp, Trash2,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const pct = v <= 1 ? v * 100 : v;
  return `${pct.toFixed(0)}%`;
}

function getQuarterMonthNames(quarter: number): [string, string, string] {
  const months = [
    ["ינואר", "פברואר", "מרץ"],
    ["אפריל", "מאי", "יוני"],
    ["יולי", "אוגוסט", "ספטמבר"],
    ["אוקטובר", "נובמבר", "דצמבר"],
  ];
  return months[quarter - 1] as [string, string, string];
}

function currentQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

// ── Column Defs ────────────────────────────────────────────────────────────

type ColDef = { id: string; label: string; sortField?: string };

const MODEL_COLS: ColDef[] = [
  { id: "brand", label: "מותג", sortField: "brand" },
  { id: "model_family", label: "משפחה", sortField: "model_family" },
  { id: "model_name", label: "דגם", sortField: "model_name" },
  { id: "segment", label: "סגמנט", sortField: "segment" },
  { id: "month1", label: "חודש 1", sortField: "month1_qty" },
  { id: "month2", label: "חודש 2", sortField: "month2_qty" },
  { id: "month3", label: "חודש 3", sortField: "month3_qty" },
  { id: "total", label: 'סה"כ', sortField: "total_qty" },
];

const MAPPING_COLS: ColDef[] = [
  { id: "product", label: "מוצר", sortField: "product_name" },
  { id: "sku", label: 'מק"ט', sortField: "sku" },
  { id: "families", label: "משפחות דגמים" },
  { id: "utilization", label: "% מימוש", sortField: "utilization_pct" },
  { id: "computed_forecast", label: "צפי מחושב" },
];

const PLAN_COLS: ColDef[] = [
  { id: "product", label: "תיאור פריט", sortField: "product_name" },
  { id: "supplier", label: "ספק", sortField: "supplier" },
  { id: "sku", label: 'מק"ט', sortField: "sku" },
  { id: "current_stock", label: "מלאי", sortField: "current_stock" },
  { id: "computed_forecast", label: "צפי רבעון", sortField: "computed_forecast" },
  { id: "utilization_pct", label: "% מימוש", sortField: "utilization_pct" },
  { id: "incoming_orders", label: 'עול"ב', sortField: "incoming_orders" },
  { id: "smoothed_required", label: "נדרש משוכלל", sortField: "smoothed_required" },
  { id: "required_to_order", label: "נדרש להזמין", sortField: "required_to_order" },
  { id: "month1_demand", label: "חודש 1" },
  { id: "month2_demand", label: "חודש 2" },
  { id: "month3_demand", label: "חודש 3" },
  { id: "order_execution_date", label: "תאריך הזמנה" },
  { id: "payment_status", label: "סטאטוס תשלום" },
  { id: "actual_ordered_qty", label: "כמות שהוזמנה", sortField: "actual_ordered_qty" },
  { id: "shipping_type", label: "סוג משלוח" },
  { id: "estimated_arrival_date", label: "תאריך הגעה" },
  { id: "notes", label: "הערות" },
];

// ── Sort Icon ──────────────────────────────────────────────────────────────

function SortIcon({ field, currentField, currentDir }: { field?: string; currentField: string | null; currentDir: "asc" | "desc" | null }) {
  if (!field || field !== currentField || !currentDir) return <ChevronDown className="h-3 w-3 opacity-30" />;
  return currentDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

// ══════════════════════════════════════════════════════════════════════════
// Main Page Component
// ══════════════════════════════════════════════════════════════════════════

export default function QuarterlyPlanningPage() {
  const { divisionName } = useParams<{ divisionName: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const division = divisionName ? decodeURIComponent(divisionName) : "";

  useEffect(() => {
    if (division && !BONDED_DIVISIONS.has(division)) {
      navigate(`/equipment/division/${encodeURIComponent(division)}`, { replace: true });
    }
  }, [division, navigate]);

  const isManager = currentUser?.role === "MANAGER";
  const isDivMgr = !!currentUser?.division && currentUser.division === division;
  const canEdit = isManager || isDivMgr;

  // ── Quarter/Year selector ──
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter());
  const monthNames = getQuarterMonthNames(selectedQuarter);

  // ── Data state ──
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [forecasts, setForecasts] = useState<QuarterlyVehicleForecast[]>([]);
  const [mappings, setMappings] = useState<ProductModelMapping[]>([]);
  const [plans, setPlans] = useState<QuarterlyProcurementPlan[]>([]);
  const [recalculating, setRecalculating] = useState(false);

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState("procurement");

  // ── Search ──
  const [modelSearch, setModelSearch] = useState("");
  const [planSearch, setPlanSearch] = useState("");

  // ── Sorting ──
  const [modelSort, setModelSort] = useState<{ field: string | null; dir: "asc" | "desc" | null }>({ field: "brand", dir: "asc" });
  const [planSort, setPlanSort] = useState<{ field: string | null; dir: "asc" | "desc" | null }>({ field: null, dir: null });
  const [mappingSort, setMappingSort] = useState<{ field: string | null; dir: "asc" | "desc" | null }>({ field: null, dir: null });

  function toggleSort(current: { field: string | null; dir: "asc" | "desc" | null }, field: string) {
    if (current.field !== field) return { field, dir: "asc" as const };
    if (current.dir === "asc") return { field, dir: "desc" as const };
    return { field: null, dir: null };
  }

  // ── Column Visibility ──
  const modelColVis = useColumnVisibility("qp-models:hidden-columns", MODEL_COLS, []);
  const modelColMenu = useColMenu();
  const mappingColVis = useColumnVisibility("qp-mappings:hidden-columns", MAPPING_COLS, []);
  const mappingColMenu = useColMenu();
  const planColVis = useColumnVisibility("qp-procurement:hidden-columns", PLAN_COLS, ["month1_demand", "month2_demand", "month3_demand", "estimated_arrival_date"]);
  const planColMenu = useColMenu();

  // ── Import dialog ──
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  // ── Add mapping dialog ──
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [newMappingProductId, setNewMappingProductId] = useState("");
  const [newMappingFamily, setNewMappingFamily] = useState("");
  const [newMappingUtil, setNewMappingUtil] = useState("1.0");

  // ── Division products (for product combobox) ──
  const [divisionProducts, setDivisionProducts] = useState<{ id: string; name: string; sku: string; supplier?: string }[]>([]);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!division) return;
    setLoading(true);

    const [modelsRes, forecastsRes, mappingsRes, plansRes, divProdsRes] = await Promise.all([
      supabase.from("vehicle_models").select("*").eq("division", division).eq("is_active", true).order("brand").order("model_family").order("model_name"),
      supabase.from("quarterly_vehicle_forecasts").select("*, vehicle_models(*)").eq("year", selectedYear).eq("quarter", selectedQuarter),
      supabase.from("product_model_mappings").select("*, products(id, name, sku)").eq("division", division),
      supabase.from("quarterly_procurement_plans").select("*, products(id, name, sku, supplier)").eq("division", division).eq("year", selectedYear).eq("quarter", selectedQuarter),
      supabase.from("division_products").select("product_id, products(id, name, sku, supplier)").eq("division", division),
    ]);

    if (modelsRes.data) setModels(modelsRes.data as VehicleModel[]);
    if (forecastsRes.data) {
      const divForecasts = (forecastsRes.data as QuarterlyVehicleForecast[]).filter(
        f => f.vehicle_models && (f.vehicle_models as VehicleModel).division === division
      );
      setForecasts(divForecasts);
    }
    if (divProdsRes.data) {
      setDivisionProducts(
        (divProdsRes.data as { product_id: string; products: { id: string; name: string; sku: string; supplier?: string } }[])
          .filter(dp => dp.products)
          .map(dp => dp.products)
      );
    }
    if (mappingsRes.data) setMappings(mappingsRes.data as ProductModelMapping[]);
    if (plansRes.data) setPlans(plansRes.data as QuarterlyProcurementPlan[]);
    setLoading(false);
  }, [division, selectedYear, selectedQuarter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!division) return;
    const channel = supabase
      .channel(`qp-${division}-${selectedYear}-${selectedQuarter}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicle_models" }, () => void fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "quarterly_vehicle_forecasts" }, () => void fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_model_mappings" }, () => void fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "quarterly_procurement_plans" }, () => void fetchData())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [division, selectedYear, selectedQuarter, fetchData]);

  // ── Forecast map (model_id → forecast) ──
  const forecastMap = useMemo(() => {
    const m = new Map<string, QuarterlyVehicleForecast>();
    for (const f of forecasts) m.set(f.vehicle_model_id, f);
    return m;
  }, [forecasts]);

  // ── Family totals (model_family → total_qty) ──
  const familyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const model of models) {
      if (!model.model_family) continue;
      const fc = forecastMap.get(model.id);
      const qty = fc?.total_qty ?? 0;
      totals.set(model.model_family, (totals.get(model.model_family) ?? 0) + qty);
    }
    return totals;
  }, [models, forecastMap]);

  // ── Model families list ──
  const modelFamilies = useMemo(() => {
    const set = new Set<string>();
    for (const m of models) if (m.model_family) set.add(m.model_family);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [models]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalForecast = Array.from(familyTotals.values()).reduce((s, v) => s + v, 0);
    const productsToOrder = plans.filter(p => (p.required_to_order ?? 0) > 0).length;
    const totalRequired = plans.reduce((s, p) => s + (p.required_to_order ?? 0), 0);
    const totalStock = plans.reduce((s, p) => s + (p.current_stock ?? 0), 0);
    const totalSmoothed = plans.reduce((s, p) => s + (p.smoothed_required ?? 0), 0);
    const coverage = totalSmoothed > 0 ? Math.round((totalStock / totalSmoothed) * 100) : 0;
    return { totalForecast, productsToOrder, totalRequired, coverage, modelCount: models.length };
  }, [familyTotals, plans, models]);

  // ── Upsert forecast (inline edit) ──
  async function upsertForecast(modelId: string, field: "month1_qty" | "month2_qty" | "month3_qty", value: number) {
    const existing = forecastMap.get(modelId);
    const payload = {
      vehicle_model_id: modelId,
      year: selectedYear,
      quarter: selectedQuarter,
      month1_qty: existing?.month1_qty ?? 0,
      month2_qty: existing?.month2_qty ?? 0,
      month3_qty: existing?.month3_qty ?? 0,
      [field]: value,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("quarterly_vehicle_forecasts")
      .upsert(payload, { onConflict: "vehicle_model_id,year,quarter" });
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else void fetchData();
  }

  // ── Patch procurement plan ──
  async function patchPlan(planId: string, patch: Record<string, unknown>) {
    const { error } = await supabase
      .from("quarterly_procurement_plans")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", planId);
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else {
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...patch } as QuarterlyProcurementPlan : p));
    }
  }

  // ── Recalculate procurement ──
  async function recalculate() {
    setRecalculating(true);
    // Build product forecast from mappings + family totals
    const productForecasts = new Map<string, { forecast: number; utilization: number; count: number }>();
    for (const m of mappings) {
      const familyQty = familyTotals.get(m.model_family) ?? 0;
      const entry = productForecasts.get(m.product_id) ?? { forecast: 0, utilization: 0, count: 0 };
      entry.forecast += familyQty;
      entry.utilization += m.utilization_pct;
      entry.count += 1;
      productForecasts.set(m.product_id, entry);
    }

    // Fetch division stock
    const { data: divProds } = await supabase
      .from("division_products")
      .select("product_id, division_stock")
      .eq("division", division);
    const stockMap = new Map<string, number>();
    for (const dp of divProds ?? []) stockMap.set(dp.product_id, dp.division_stock ?? 0);

    const upserts: Record<string, unknown>[] = [];
    for (const [productId, entry] of productForecasts) {
      const avgUtil = entry.count > 0 ? entry.utilization / entry.count : 1;
      const forecast = entry.forecast;
      const safetyBuffer = 1.2;
      const smoothed = Math.ceil(forecast * avgUtil * safetyBuffer);
      const stock = stockMap.get(productId) ?? 0;
      const toOrder = Math.max(0, smoothed - stock);

      upserts.push({
        division,
        product_id: productId,
        year: selectedYear,
        quarter: selectedQuarter,
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
      });
    }

    if (upserts.length > 0) {
      const { error } = await supabase
        .from("quarterly_procurement_plans")
        .upsert(upserts, { onConflict: "division,product_id,year,quarter" });
      if (error) toast({ title: "שגיאה בחישוב", description: error.message, variant: "destructive" });
      else toast({ title: "חישוב הושלם", description: `${upserts.length} מוצרים עודכנו` });
    } else {
      toast({ title: "אין נתונים", description: "לא נמצאו מיפויי מוצרים-דגמים לחישוב" });
    }

    void fetchData();
    setRecalculating(false);
  }

  // ── Excel import handler ──
  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    const lines = importText.trim().split("\n").filter(l => l.trim());
    const rows: { brand: string; model_name: string; model_family?: string; segment?: string; m1: number; m2: number; m3: number }[] = [];

    for (const line of lines.slice(1)) { // skip header
      const cols = line.split("\t");
      if (cols.length < 4) continue;
      const hasExtras = cols.length >= 6;
      rows.push({
        brand: hasExtras ? cols[0].trim() : "",
        model_family: hasExtras ? cols[1].trim() : undefined,
        model_name: hasExtras ? cols[2].trim() : cols[0].trim(),
        m1: parseInt(cols[hasExtras ? 3 : 1]) || 0,
        m2: parseInt(cols[hasExtras ? 4 : 2]) || 0,
        m3: parseInt(cols[hasExtras ? 5 : 3]) || 0,
      });
    }

    let ok = 0;
    for (const row of rows) {
      const { data: model, error: modelErr } = await supabase
        .from("vehicle_models")
        .upsert({
          division,
          brand: row.brand || "Unknown",
          model_name: row.model_name,
          model_family: row.model_family || null,
          segment: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "division,model_name,segment" })
        .select("id")
        .single();

      if (modelErr || !model) continue;

      const { error: fErr } = await supabase
        .from("quarterly_vehicle_forecasts")
        .upsert({
          vehicle_model_id: model.id,
          year: selectedYear,
          quarter: selectedQuarter,
          month1_qty: row.m1,
          month2_qty: row.m2,
          month3_qty: row.m3,
          updated_at: new Date().toISOString(),
        }, { onConflict: "vehicle_model_id,year,quarter" });

      if (!fErr) ok++;
    }

    toast({ title: "ייבוא הושלם", description: `${ok} מתוך ${rows.length} שורות יובאו בהצלחה` });
    setShowImport(false);
    setImportText("");
    setImporting(false);
    void fetchData();
  }

  // ── Add mapping ──
  async function handleAddMapping() {
    if (!newMappingProductId || !newMappingFamily) return;
    const { error } = await supabase
      .from("product_model_mappings")
      .upsert({
        division,
        product_id: newMappingProductId,
        model_family: newMappingFamily,
        utilization_pct: parseFloat(newMappingUtil) || 1.0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "division,product_id,model_family" });
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else {
      toast({ title: "מיפוי נוסף" });
      setShowAddMapping(false);
      setNewMappingProductId("");
      setNewMappingFamily("");
      setNewMappingUtil("1.0");
      void fetchData();
    }
  }

  // ── Delete mapping ──
  async function deleteMapping(id: string) {
    const { error } = await supabase.from("product_model_mappings").delete().eq("id", id);
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else void fetchData();
  }

  // ── Export CSV ──
  function exportCsv() {
    const headers = ["מוצר", "ספק", "מק\"ט", "מלאי", "צפי", "% מימוש", "עול\"ב", "נדרש משוכלל", "נדרש להזמין", monthNames[0], monthNames[1], monthNames[2], "סוג משלוח", "הערות"];
    const csvRows = [headers.join(",")];
    for (const p of plans) {
      csvRows.push([
        `"${p.products?.name ?? ""}"`, `"${p.products?.supplier ?? ""}"`, `"${p.products?.sku ?? ""}"`,
        p.current_stock ?? "", p.computed_forecast ?? "", fmtPct(p.utilization_pct), p.incoming_orders ?? "",
        p.smoothed_required ?? "", p.required_to_order ?? "",
        p.month1_demand ?? "", p.month2_demand ?? "", p.month3_demand ?? "",
        `"${p.shipping_type ?? ""}"`, `"${p.notes ?? ""}"`,
      ].join(","));
    }
    const blob = new Blob(["﻿" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quarterly-plan-${division}-Q${selectedQuarter}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filtered & sorted data ──
  const filteredModels = useMemo(() => {
    let result = models.filter(m => {
      if (!modelSearch) return true;
      const q = modelSearch.toLowerCase();
      return m.model_name.toLowerCase().includes(q) || m.brand.toLowerCase().includes(q) || (m.model_family ?? "").toLowerCase().includes(q);
    });
    if (modelSort.field && modelSort.dir) {
      const { field, dir } = modelSort;
      result = [...result].sort((a, b) => {
        let av: unknown, bv: unknown;
        if (field === "month1_qty" || field === "month2_qty" || field === "month3_qty" || field === "total_qty") {
          const fa = forecastMap.get(a.id);
          const fb = forecastMap.get(b.id);
          av = fa?.[field as keyof QuarterlyVehicleForecast] ?? 0;
          bv = fb?.[field as keyof QuarterlyVehicleForecast] ?? 0;
        } else {
          av = (a as Record<string, unknown>)[field] ?? "";
          bv = (b as Record<string, unknown>)[field] ?? "";
        }
        if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
        return dir === "asc" ? String(av).localeCompare(String(bv), "he") : String(bv).localeCompare(String(av), "he");
      });
    }
    return result;
  }, [models, modelSearch, modelSort, forecastMap]);

  const filteredPlans = useMemo(() => {
    let result = plans.filter(p => {
      if (!planSearch) return true;
      const q = planSearch.toLowerCase();
      return (p.products?.name ?? "").toLowerCase().includes(q) || (p.products?.sku ?? "").toLowerCase().includes(q) || (p.products?.supplier ?? "").toLowerCase().includes(q);
    });
    if (planSort.field && planSort.dir) {
      const { field, dir } = planSort;
      result = [...result].sort((a, b) => {
        const av = field === "product_name" ? a.products?.name : field === "supplier" ? a.products?.supplier : field === "sku" ? a.products?.sku : (a as Record<string, unknown>)[field];
        const bv = field === "product_name" ? b.products?.name : field === "supplier" ? b.products?.supplier : field === "sku" ? b.products?.sku : (b as Record<string, unknown>)[field];
        if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
        return dir === "asc" ? String(av ?? "").localeCompare(String(bv ?? ""), "he") : String(bv ?? "").localeCompare(String(av ?? ""), "he");
      });
    }
    return result;
  }, [plans, planSearch, planSort]);

  // ── Product combobox options ──
  const productOptions: ComboboxOption[] = useMemo(() => {
    return divisionProducts.map(p => ({
      value: p.id,
      label: p.name,
      hint: p.sku || undefined,
      keywords: [p.sku, p.supplier].filter(Boolean) as string[],
    }));
  }, [divisionProducts]);

  // ── Mapping enrichment ──
  type EnrichedMapping = ProductModelMapping & { computedForecast: number };
  const enrichedMappings = useMemo(() => {
    const grouped = new Map<string, ProductModelMapping[]>();
    for (const m of mappings) {
      const key = m.product_id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }

    const result: EnrichedMapping[] = [];
    for (const [, group] of grouped) {
      let totalForecast = 0;
      for (const m of group) {
        totalForecast += (familyTotals.get(m.model_family) ?? 0);
      }
      const avgUtil = group.reduce((s, m) => s + m.utilization_pct, 0) / group.length;
      // Use first mapping as representative, attach enriched data
      result.push({
        ...group[0],
        utilization_pct: avgUtil,
        computedForecast: Math.ceil(totalForecast * avgUtil),
      });
    }
    return result;
  }, [mappings, familyTotals]);

  // ── Render ──
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">תכנון רכש רבעוני</h1>
          <p className="text-sm text-muted-foreground">{division}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(selectedQuarter)} onValueChange={v => setSelectedQuarter(Number(v))}>
            <SelectTrigger className="h-9 w-24 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="h-9 w-24 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "דגמי רכב", value: kpis.modelCount, icon: Calendar, color: "text-blue-500" },
          { label: "צפי רבעוני", value: fmtNum(kpis.totalForecast), icon: TrendingUp, color: "text-green-500" },
          { label: "מוצרים לרכישה", value: kpis.productsToOrder, icon: ShoppingCart, color: "text-amber-500" },
          { label: "כיסוי מלאי", value: `${kpis.coverage}%`, icon: Package, color: kpis.coverage >= 70 ? "text-green-500" : kpis.coverage >= 30 ? "text-amber-500" : "text-red-500" },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-xl border p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
              <span className="text-[10px] sm:text-xs text-muted-foreground">{k.label}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="procurement">תכנון רכש</TabsTrigger>
          <TabsTrigger value="models">תחזית דגמים</TabsTrigger>
          <TabsTrigger value="mappings">מיפוי מוצרים</TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: Procurement Plan ═══ */}
        <TabsContent value="procurement" className="space-y-3 mt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={planSearch} onChange={e => setPlanSearch(e.target.value)} placeholder='חיפוש מוצר / מק"ט / ספק...' className="h-9 text-sm pr-8" />
              {planSearch && <button onClick={() => setPlanSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="flex items-center gap-1.5">
              {canEdit && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={recalculate} disabled={recalculating}>
                  <RefreshCw className={`h-3 w-3 ${recalculating ? "animate-spin" : ""}`} />
                  חישוב מחדש
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" onClick={exportCsv}>
                <Download className="h-3 w-3" />
                ייצוא
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(planColVis.hiddenCols, planColMenu.setMenu)}>
                      {PLAN_COLS.map(col => planColVis.isVisible(col.id) ? (
                        <th key={col.id} className="text-right p-3 font-semibold text-foreground whitespace-nowrap" onContextMenu={colThContextMenu(col, planColMenu.setMenu)}>
                          {col.sortField ? (
                            <button onClick={() => setPlanSort(toggleSort(planSort, col.sortField!))} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
                              {col.label} <SortIcon field={col.sortField} currentField={planSort.field} currentDir={planSort.dir} />
                            </button>
                          ) : col.label}
                        </th>
                      ) : null)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlans.length === 0 ? (
                      <tr><td colSpan={planColVis.visibleCount} className="p-8 text-center text-muted-foreground">
                        {plans.length === 0 ? 'אין תוכניות רכש. לחץ "חישוב מחדש" ליצירת תוכנית מתחזיות הדגמים' : "אין תוצאות לחיפוש"}
                      </td></tr>
                    ) : filteredPlans.map(plan => (
                      <tr key={plan.id} className="border-b hover:bg-muted/30 transition-colors">
                        {planColVis.isVisible("product") && <td className="p-3 font-medium">{plan.products?.name ?? "—"}</td>}
                        {planColVis.isVisible("supplier") && <td className="p-3 text-muted-foreground">{plan.products?.supplier ?? "—"}</td>}
                        {planColVis.isVisible("sku") && <td className="p-3 text-muted-foreground font-mono text-xs">{plan.products?.sku ?? "—"}</td>}
                        {planColVis.isVisible("current_stock") && (
                          <td className="p-3 tabular-nums">{fmtNum(plan.current_stock)}</td>
                        )}
                        {planColVis.isVisible("computed_forecast") && (
                          <td className="p-3 tabular-nums">
                            <InlineEditCell
                              value={plan.manual_forecast_override ?? plan.computed_forecast}
                              type="number"
                              disabled={!canEdit}
                              onCommit={v => patchPlan(plan.id, { manual_forecast_override: v as number })}
                              display={v => <span>{fmtNum(v as number)}{plan.manual_forecast_override != null && <Badge variant="outline" className="text-[9px] ms-1">ידני</Badge>}</span>}
                            />
                          </td>
                        )}
                        {planColVis.isVisible("utilization_pct") && <td className="p-3 tabular-nums">{fmtPct(plan.utilization_pct)}</td>}
                        {planColVis.isVisible("incoming_orders") && (
                          <td className="p-3">
                            <InlineEditCell value={plan.incoming_orders} type="number" disabled={!canEdit} onCommit={v => patchPlan(plan.id, { incoming_orders: v as number })} display={v => fmtNum(v as number)} />
                          </td>
                        )}
                        {planColVis.isVisible("smoothed_required") && <td className="p-3 tabular-nums font-medium">{fmtNum(plan.smoothed_required)}</td>}
                        {planColVis.isVisible("required_to_order") && (
                          <td className="p-3 tabular-nums font-bold">
                            <span className={(plan.required_to_order ?? 0) > 0 ? "text-amber-600" : "text-green-600"}>{fmtNum(plan.required_to_order)}</span>
                          </td>
                        )}
                        {planColVis.isVisible("month1_demand") && <td className="p-3 tabular-nums">{fmtNum(plan.month1_demand)}</td>}
                        {planColVis.isVisible("month2_demand") && <td className="p-3 tabular-nums">{fmtNum(plan.month2_demand)}</td>}
                        {planColVis.isVisible("month3_demand") && <td className="p-3 tabular-nums">{fmtNum(plan.month3_demand)}</td>}
                        {planColVis.isVisible("order_execution_date") && (
                          <td className="p-3">
                            <InlineEditCell value={plan.order_execution_date} type="date" disabled={!canEdit} onCommit={v => patchPlan(plan.id, { order_execution_date: v })} />
                          </td>
                        )}
                        {planColVis.isVisible("payment_status") && (
                          <td className="p-3">
                            <InlineSelectCell
                              value={plan.payment_status}
                              options={["ממתין", "מקדמה", "שולם", "יתרה"]}
                              disabled={!canEdit}
                              onCommit={v => patchPlan(plan.id, { payment_status: v })}
                            />
                          </td>
                        )}
                        {planColVis.isVisible("actual_ordered_qty") && (
                          <td className="p-3">
                            <InlineEditCell value={plan.actual_ordered_qty} type="number" disabled={!canEdit} onCommit={v => patchPlan(plan.id, { actual_ordered_qty: v as number })} display={v => fmtNum(v as number)} />
                          </td>
                        )}
                        {planColVis.isVisible("shipping_type") && (
                          <td className="p-3">
                            <InlineSelectCell
                              value={plan.shipping_type}
                              options={["ימי", "אווירי רגיל", "אווירי דחוף", "DHL"]}
                              disabled={!canEdit}
                              onCommit={v => patchPlan(plan.id, { shipping_type: v })}
                            />
                          </td>
                        )}
                        {planColVis.isVisible("estimated_arrival_date") && (
                          <td className="p-3">
                            <InlineEditCell value={plan.estimated_arrival_date} type="date" disabled={!canEdit} onCommit={v => patchPlan(plan.id, { estimated_arrival_date: v })} />
                          </td>
                        )}
                        {planColVis.isVisible("notes") && (
                          <td className="p-3 max-w-[200px]">
                            <InlineEditCell value={plan.notes} disabled={!canEdit} onCommit={v => patchPlan(plan.id, { notes: v })} placeholder="הערות..." />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {planColMenu.menu && (
            <ColContextMenu
              menu={planColMenu.menu}
              sortField={planSort.field}
              sortDir={planSort.dir}
              hiddenCols={planColVis.hiddenCols}
              onClose={planColMenu.closeMenu}
              onHide={planColVis.hide}
              onShow={planColVis.show}
              onSortAsc={field => setPlanSort({ field, dir: "asc" })}
              onSortDesc={field => setPlanSort({ field, dir: "desc" })}
            />
          )}
        </TabsContent>

        {/* ═══ Tab 2: Vehicle Model Forecast ═══ */}
        <TabsContent value="models" className="space-y-3 mt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={modelSearch} onChange={e => setModelSearch(e.target.value)} placeholder="חיפוש דגם / מותג / משפחה..." className="h-9 text-sm pr-8" />
              {modelSearch && <button onClick={() => setModelSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="flex items-center gap-1.5">
              {canEdit && (
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" onClick={() => setShowImport(true)}>
                  <Upload className="h-3 w-3" />
                  ייבוא מאקסל
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(modelColVis.hiddenCols, modelColMenu.setMenu)}>
                      {MODEL_COLS.map(col => {
                        let label = col.label;
                        if (col.id === "month1") label = monthNames[0];
                        if (col.id === "month2") label = monthNames[1];
                        if (col.id === "month3") label = monthNames[2];
                        return modelColVis.isVisible(col.id) ? (
                          <th key={col.id} className="text-right p-3 font-semibold text-foreground whitespace-nowrap" onContextMenu={colThContextMenu(col, modelColMenu.setMenu)}>
                            {col.sortField ? (
                              <button onClick={() => setModelSort(toggleSort(modelSort, col.sortField!))} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
                                {label} <SortIcon field={col.sortField} currentField={modelSort.field} currentDir={modelSort.dir} />
                              </button>
                            ) : label}
                          </th>
                        ) : null;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModels.length === 0 ? (
                      <tr><td colSpan={modelColVis.visibleCount} className="p-8 text-center text-muted-foreground">
                        אין דגמי רכב. לחץ "ייבוא מאקסל" להוספת דגמים
                      </td></tr>
                    ) : filteredModels.map(model => {
                      const fc = forecastMap.get(model.id);
                      return (
                        <tr key={model.id} className="border-b hover:bg-muted/30 transition-colors">
                          {modelColVis.isVisible("brand") && <td className="p-3 font-medium">{model.brand}</td>}
                          {modelColVis.isVisible("model_family") && <td className="p-3"><Badge variant="outline" className="text-xs">{model.model_family ?? "—"}</Badge></td>}
                          {modelColVis.isVisible("model_name") && <td className="p-3">{model.model_name}</td>}
                          {modelColVis.isVisible("segment") && <td className="p-3 text-xs text-muted-foreground">{model.segment ?? "—"}</td>}
                          {modelColVis.isVisible("month1") && (
                            <td className="p-3">
                              <InlineEditCell
                                value={fc?.month1_qty ?? 0}
                                type="number"
                                disabled={!canEdit}
                                onCommit={v => upsertForecast(model.id, "month1_qty", (v as number) ?? 0)}
                                display={v => <span className="tabular-nums">{fmtNum(v as number)}</span>}
                              />
                            </td>
                          )}
                          {modelColVis.isVisible("month2") && (
                            <td className="p-3">
                              <InlineEditCell
                                value={fc?.month2_qty ?? 0}
                                type="number"
                                disabled={!canEdit}
                                onCommit={v => upsertForecast(model.id, "month2_qty", (v as number) ?? 0)}
                                display={v => <span className="tabular-nums">{fmtNum(v as number)}</span>}
                              />
                            </td>
                          )}
                          {modelColVis.isVisible("month3") && (
                            <td className="p-3">
                              <InlineEditCell
                                value={fc?.month3_qty ?? 0}
                                type="number"
                                disabled={!canEdit}
                                onCommit={v => upsertForecast(model.id, "month3_qty", (v as number) ?? 0)}
                                display={v => <span className="tabular-nums">{fmtNum(v as number)}</span>}
                              />
                            </td>
                          )}
                          {modelColVis.isVisible("total") && (
                            <td className="p-3 font-bold tabular-nums">{fmtNum(fc?.total_qty ?? 0)}</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Family summary */}
          {modelFamilies.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <h3 className="text-sm font-semibold mb-2">סיכום לפי משפחה</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {modelFamilies.map(family => (
                    <div key={family} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-sm">{family}</span>
                      <span className="text-sm font-bold tabular-nums">{fmtNum(familyTotals.get(family) ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {modelColMenu.menu && (
            <ColContextMenu
              menu={modelColMenu.menu}
              sortField={modelSort.field}
              sortDir={modelSort.dir}
              hiddenCols={modelColVis.hiddenCols}
              onClose={modelColMenu.closeMenu}
              onHide={modelColVis.hide}
              onShow={modelColVis.show}
              onSortAsc={field => setModelSort({ field, dir: "asc" })}
              onSortDesc={field => setModelSort({ field, dir: "desc" })}
            />
          )}
        </TabsContent>

        {/* ═══ Tab 3: Product-Model Mappings ═══ */}
        <TabsContent value="mappings" className="space-y-3 mt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">מיפוי מוצרים למשפחות דגמים — לכל מוצר, אילו דגמי רכב צורכים אותו</p>
            {canEdit && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowAddMapping(true)}>
                <Plus className="h-3 w-3" />
                מיפוי חדש
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(mappingColVis.hiddenCols, mappingColMenu.setMenu)}>
                      {MAPPING_COLS.map(col => mappingColVis.isVisible(col.id) ? (
                        <th key={col.id} className="text-right p-3 font-semibold text-foreground whitespace-nowrap" onContextMenu={colThContextMenu(col, mappingColMenu.setMenu)}>
                          {col.sortField ? (
                            <button onClick={() => setMappingSort(toggleSort(mappingSort, col.sortField!))} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
                              {col.label} <SortIcon field={col.sortField} currentField={mappingSort.field} currentDir={mappingSort.dir} />
                            </button>
                          ) : col.label}
                        </th>
                      ) : null)}
                      <th className="p-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedMappings.length === 0 ? (
                      <tr><td colSpan={mappingColVis.visibleCount + 1} className="p-8 text-center text-muted-foreground">
                        אין מיפויים. לחץ "מיפוי חדש" להוספה
                      </td></tr>
                    ) : enrichedMappings.map(em => {
                      const productMappings = mappings.filter(m => m.product_id === em.product_id);
                      return (
                        <tr key={em.id} className="border-b hover:bg-muted/30 transition-colors">
                          {mappingColVis.isVisible("product") && <td className="p-3 font-medium">{em.products?.name ?? "—"}</td>}
                          {mappingColVis.isVisible("sku") && <td className="p-3 font-mono text-xs text-muted-foreground">{em.products?.sku ?? "—"}</td>}
                          {mappingColVis.isVisible("families") && (
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {productMappings.map(m => (
                                  <Badge key={m.id} variant="secondary" className="text-[10px] gap-1">
                                    {m.model_family}
                                    {canEdit && (
                                      <button onClick={() => deleteMapping(m.id)} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          )}
                          {mappingColVis.isVisible("utilization") && (
                            <td className="p-3 tabular-nums">{fmtPct(em.utilization_pct)}</td>
                          )}
                          {mappingColVis.isVisible("computed_forecast") && (
                            <td className="p-3 tabular-nums font-bold">{fmtNum(em.computedForecast)}</td>
                          )}
                          <td className="p-3">
                            {canEdit && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                // Delete all mappings for this product
                                for (const m of productMappings) void deleteMapping(m.id);
                              }}>
                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {mappingColMenu.menu && (
            <ColContextMenu
              menu={mappingColMenu.menu}
              sortField={mappingSort.field}
              sortDir={mappingSort.dir}
              hiddenCols={mappingColVis.hiddenCols}
              onClose={mappingColMenu.closeMenu}
              onHide={mappingColVis.hide}
              onShow={mappingColVis.show}
              onSortAsc={field => setMappingSort({ field, dir: "asc" })}
              onSortDesc={field => setMappingSort({ field, dir: "desc" })}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Import Dialog ── */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ייבוא תחזית דגמים מאקסל</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              הדבק נתונים מאקסל. פורמט: <strong>מותג → משפחה → דגם → חודש1 → חודש2 → חודש3</strong>
              <br />או: <strong>דגם → חודש1 → חודש2 → חודש3</strong>
            </p>
            <Textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={"מותג\tמשפחה\tדגם\tחודש1\tחודש2\tחודש3\nRenault\tקשקאי\tQashqai III CVT 2X4\t40\t35\t25"}
              rows={12}
              className="font-mono text-xs"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              {importText.trim().split("\n").length - 1} שורות זוהו (לא כולל כותרת)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)} disabled={importing}>ביטול</Button>
            <Button onClick={handleImport} disabled={importing || !importText.trim()}>
              {importing ? <RefreshCw className="h-3 w-3 animate-spin me-1" /> : <Upload className="h-3 w-3 me-1" />}
              ייבוא
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Mapping Dialog ── */}
      <Dialog open={showAddMapping} onOpenChange={setShowAddMapping}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מיפוי מוצר למשפחת דגמים</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">מוצר</label>
              <div className="mt-1">
                <Combobox
                  value={newMappingProductId}
                  onValueChange={setNewMappingProductId}
                  options={productOptions}
                  placeholder="חפש מוצר..."
                  searchPlaceholder='חיפוש לפי שם / מק"ט / ספק...'
                  emptyText="לא נמצאו מוצרים"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">משפחת דגמים</label>
              <Select value={newMappingFamily} onValueChange={setNewMappingFamily}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="בחר משפחה..." /></SelectTrigger>
                <SelectContent>
                  {modelFamilies.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">% מימוש (0-1)</label>
              <Input type="number" step="0.01" min="0" max="1" value={newMappingUtil} onChange={e => setNewMappingUtil(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMapping(false)}>ביטול</Button>
            <Button onClick={handleAddMapping} disabled={!newMappingProductId || !newMappingFamily}>הוסף מיפוי</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
