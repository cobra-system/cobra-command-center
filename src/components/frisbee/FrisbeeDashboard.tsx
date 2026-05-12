import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import {
  ColContextMenu, useColMenu, colThContextMenu, trContextMenu,
} from "@/components/ui/ColContextMenu";
import { TrendingUp, TrendingDown, Minus, BarChart3, LineChart, Search, Download } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { ColDef } from "@/hooks/useColumnVisibility";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyStatRow {
  equipment_name: string;
  month: string; // "YYYY-MM"
  installed_count: number;
  inspection_count: number;
}

interface ModelStatRow {
  manufacturer: string;
  model: string;
  inspection_count: number;
  total_accessories: number;
  avg_per_vehicle: number;
  top_accessories: { name: string; count: number }[] | null;
}

interface Props {
  branchId: string;
  division: string;
  lastSynced: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_COLORS = [
  "#1e3a5f", "#2563eb", "#38bdf8", "#7c3aed", "#a78bfa",
  "#06b6d4", "#0891b2", "#1d4ed8", "#6d28d9", "#0e7490",
  "#1e40af", "#4f46e5",
];

const PIE_COLORS = [
  "#1e3a5f", "#2563eb", "#38bdf8", "#7c3aed", "#a78bfa",
  "#06b6d4", "#0891b2", "#1d4ed8", "#6d28d9", "#0e7490",
];

const MONTH_RANGE_OPTIONS = [
  { value: "3",  label: "3 חודשים" },
  { value: "6",  label: "6 חודשים" },
  { value: "12", label: "12 חודשים" },
  { value: "24", label: "24 חודשים" },
];

// ─── Column defs ──────────────────────────────────────────────────────────────

const CONSUMPTION_COLS: ColDef[] = [
  { id: "equipment", label: "אביזר" },
  { id: "total",     label: 'סה"כ',           sortField: "total" },
  { id: "monthly",   label: "ממוצע חודשי",    sortField: "monthly" },
  { id: "avg3",      label: "ממוצע 3 חודשים", sortField: "avg3" },
  { id: "trend",     label: "מגמה" },
];

const MODEL_COLS: ColDef[] = [
  { id: "manufacturer", label: "יצרן" },
  { id: "model",        label: "דגם" },
  { id: "inspections",  label: "בדיקות",         sortField: "inspections" },
  { id: "total",        label: 'סה"כ אביזרים',   sortField: "total" },
  { id: "avg",          label: "ממוצע לרכב",     sortField: "avg" },
  { id: "trend",        label: "מגמה" },
  { id: "top",          label: "אביזרים מובילים" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hebrewMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  const months = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני",
                   "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

type TrendDir = "up" | "down" | "flat";

function calcTrend(values: number[]): TrendDir {
  if (values.length < 2) return "flat";
  const last = values[values.length - 1];
  const prev = values.slice(0, -1);
  const prevAvg = prev.reduce((s, v) => s + v, 0) / prev.length;
  if (last > prevAvg * 1.05) return "up";
  if (last < prevAvg * 0.95) return "down";
  return "flat";
}

function TrendIcon({ dir }: { dir: TrendDir }) {
  if (dir === "up")   return <TrendingUp   className="w-4 h-4 text-green-600" />;
  if (dir === "down") return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FrisbeeDashboard({ branchId, lastSynced }: Props) {
  // ── Shared filter state ──
  const [monthRange, setMonthRange] = useState("6");
  const [activeTab, setActiveTab] = useState("consumption");

  // ── Tab 1 & 3 data (monthly stats) ──
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStatRow[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // ── Tab 2 data (model stats) ──
  const [modelStats, setModelStats] = useState<ModelStatRow[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // ── Tab 1 filters ──
  const [consumptionModelFilter, setConsumptionModelFilter] = useState("all");
  const [consumptionEquipFilter, setConsumptionEquipFilter] = useState("all");

  // ── Tab 2 filters ──
  const [salesEquipFilter, setSalesEquipFilter] = useState("all");
  const [salesManufacturerFilter, setSalesManufacturerFilter] = useState("all");
  const [salesMonthRange, setSalesMonthRange] = useState("6");

  // ── Tab 3 filters ──
  const [searchDateFrom, setSearchDateFrom] = useState(() =>
    format(startOfMonth(subMonths(new Date(), 3)), "yyyy-MM-dd")
  );
  const [searchDateTo, setSearchDateTo] = useState(() =>
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [searchModelFilter, setSearchModelFilter] = useState("all");
  const [selectedEquipTags, setSelectedEquipTags] = useState<string[]>([]);
  const [searchEquipInput, setSearchEquipInput] = useState("");

  // ── Column visibility ──
  const consumptionColVis = useColumnVisibility("frisbee-consumption-v2:hidden-columns", CONSUMPTION_COLS);
  const modelColVis = useColumnVisibility("frisbee-models:hidden-columns", MODEL_COLS);
  const { menu: consumMenu, setMenu: setConsumMenu, closeMenu: closeConsumMenu } = useColMenu();
  const { menu: modelMenu, setMenu: setModelMenu, closeMenu: closeModelMenu } = useColMenu();

  // ── Date range calculation ──
  const { startDate, endDate } = useMemo(() => {
    const n = parseInt(monthRange, 10);
    return {
      startDate: format(startOfMonth(subMonths(new Date(), n - 1)), "yyyy-MM-dd"),
      endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    };
  }, [monthRange]);

  const { startDate: salesStartDate, endDate: salesEndDate } = useMemo(() => {
    const n = parseInt(salesMonthRange, 10);
    return {
      startDate: format(startOfMonth(subMonths(new Date(), n - 1)), "yyyy-MM-dd"),
      endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    };
  }, [salesMonthRange]);

  // ── Data fetching ──
  const fetchMonthlyStats = useCallback(async (sd: string, ed: string) => {
    setLoadingMonthly(true);
    const { data } = await supabase.rpc("get_frisbee_monthly_stats", {
      p_branch_id: branchId,
      p_start_date: sd,
      p_end_date: ed,
    });
    setMonthlyStats(
      (data ?? []).map((r: MonthlyStatRow) => ({
        ...r,
        installed_count: Number(r.installed_count),
        inspection_count: Number(r.inspection_count),
      }))
    );
    setLoadingMonthly(false);
  }, [branchId]);

  const fetchModelStats = useCallback(async (sd: string, ed: string) => {
    setLoadingModels(true);
    const { data } = await supabase.rpc("get_frisbee_model_stats", {
      p_branch_id: branchId,
      p_start_date: sd,
      p_end_date: ed,
    });
    setModelStats(
      (data ?? []).map((r: ModelStatRow) => ({
        ...r,
        inspection_count: Number(r.inspection_count),
        total_accessories: Number(r.total_accessories),
        avg_per_vehicle: Number(r.avg_per_vehicle),
      }))
    );
    setLoadingModels(false);
  }, [branchId]);

  // Fetch on mount and when date range changes
  useEffect(() => { fetchMonthlyStats(startDate, endDate); }, [fetchMonthlyStats, startDate, endDate]);
  useEffect(() => { fetchModelStats(salesStartDate, salesEndDate); }, [fetchModelStats, salesStartDate, salesEndDate]);

  // Fetch for Tab 3 custom date range
  const [searchStats, setSearchStats] = useState<MonthlyStatRow[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const fetchSearchStats = useCallback(async () => {
    setLoadingSearch(true);
    const { data } = await supabase.rpc("get_frisbee_monthly_stats", {
      p_branch_id: branchId,
      p_start_date: searchDateFrom,
      p_end_date: searchDateTo,
    });
    setSearchStats(
      (data ?? []).map((r: MonthlyStatRow) => ({
        ...r,
        installed_count: Number(r.installed_count),
        inspection_count: Number(r.inspection_count),
      }))
    );
    setLoadingSearch(false);
  }, [branchId, searchDateFrom, searchDateTo]);

  useEffect(() => { fetchSearchStats(); }, [fetchSearchStats]);

  // ─── Derived data for Tab 1 ───────────────────────────────────────────────

  // Unique months in chronological order
  const allMonths = useMemo(() =>
    [...new Set(monthlyStats.map(r => r.month))].sort(), [monthlyStats]);

  // Unique equipment names
  const allEquipment = useMemo(() =>
    [...new Set(monthlyStats.map(r => r.equipment_name))].sort(), [monthlyStats]);

  // Unique models from monthly stats
  const allModels = useMemo(() =>
    [...new Set(modelStats.map(r => r.model).filter(Boolean))].sort(), [modelStats]);

  // Unique manufacturers
  const allManufacturers = useMemo(() =>
    [...new Set(modelStats.map(r => r.manufacturer).filter(Boolean))].sort(), [modelStats]);

  // Monthly stats filtered for Tab 1
  const filteredMonthly = useMemo(() => {
    let rows = monthlyStats;
    if (consumptionEquipFilter !== "all")
      rows = rows.filter(r => r.equipment_name === consumptionEquipFilter);
    return rows;
  }, [monthlyStats, consumptionEquipFilter]);

  // Bar chart data: one entry per equipment_name, bars per month
  const barChartData = useMemo(() => {
    const equipList = consumptionEquipFilter !== "all"
      ? [consumptionEquipFilter]
      : [...new Set(filteredMonthly.map(r => r.equipment_name))];

    return equipList.map(equip => {
      const entry: Record<string, unknown> = { equipment: equip };
      allMonths.forEach(m => {
        const row = filteredMonthly.find(r => r.equipment_name === equip && r.month === m);
        entry[m] = row?.installed_count ?? 0;
      });
      return entry;
    }).sort((a, b) => {
      const totalA = allMonths.reduce((s, m) => s + (Number(a[m]) || 0), 0);
      const totalB = allMonths.reduce((s, m) => s + (Number(b[m]) || 0), 0);
      return totalB - totalA;
    });
  }, [filteredMonthly, allMonths, consumptionEquipFilter]);

  // Summary table rows for Tab 1
  const summaryRows = useMemo(() => {
    const equipList = consumptionEquipFilter !== "all"
      ? [consumptionEquipFilter]
      : [...new Set(filteredMonthly.map(r => r.equipment_name))];

    return equipList.map(equip => {
      const rows = filteredMonthly.filter(r => r.equipment_name === equip);
      const byMonth = allMonths.map(m => rows.find(r => r.month === m)?.installed_count ?? 0);
      const total = byMonth.reduce((s, v) => s + v, 0);
      const monthly = byMonth.length ? total / byMonth.length : 0;
      const last3 = byMonth.slice(-3);
      const avg3 = last3.length ? last3.reduce((s, v) => s + v, 0) / last3.length : 0;
      const trend = calcTrend(byMonth);
      return { equipment: equip, total, monthly, avg3, trend };
    }).sort((a, b) => b.total - a.total);
  }, [filteredMonthly, allMonths, consumptionEquipFilter]);

  // ─── Derived data for Tab 2 ───────────────────────────────────────────────

  const filteredModels = useMemo(() => {
    let rows = modelStats;
    if (salesManufacturerFilter !== "all")
      rows = rows.filter(r => r.manufacturer === salesManufacturerFilter);
    return rows;
  }, [modelStats, salesManufacturerFilter]);

  const overallAvg = useMemo(() => {
    const totalInsp = filteredModels.reduce((s, r) => s + r.inspection_count, 0);
    const totalAcc = filteredModels.reduce((s, r) => s + r.total_accessories, 0);
    return totalInsp ? totalAcc / totalInsp : 0;
  }, [filteredModels]);

  const maxModel = useMemo(() =>
    filteredModels.reduce<ModelStatRow | null>((max, r) =>
      !max || r.avg_per_vehicle > max.avg_per_vehicle ? r : max, null),
    [filteredModels]);

  const minModel = useMemo(() =>
    filteredModels.filter(r => r.inspection_count >= 5).reduce<ModelStatRow | null>((min, r) =>
      !min || r.avg_per_vehicle < min.avg_per_vehicle ? r : min, null),
    [filteredModels]);

  const topModelByInspections = useMemo(() =>
    filteredModels.reduce<ModelStatRow | null>((max, r) =>
      !max || r.inspection_count > max.inspection_count ? r : max, null),
    [filteredModels]);

  // Pie chart: top accessories aggregated
  const pieData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredModels.forEach(r => {
      (r.top_accessories ?? []).forEach(ta => {
        counts.set(ta.name, (counts.get(ta.name) ?? 0) + ta.count);
      });
    });
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredModels]);

  // Bar chart: avg per vehicle per model (top 8)
  const modelBarData = useMemo(() =>
    [...filteredModels]
      .sort((a, b) => b.avg_per_vehicle - a.avg_per_vehicle)
      .slice(0, 8)
      .map(r => ({ model: r.model, avg: parseFloat(r.avg_per_vehicle.toFixed(1)) })),
    [filteredModels]);

  // ─── Derived data for Tab 3 ───────────────────────────────────────────────

  const searchMonths = useMemo(() =>
    [...new Set(searchStats.map(r => r.month))].sort(), [searchStats]);

  const searchEquipNames = useMemo(() =>
    [...new Set(searchStats.map(r => r.equipment_name))].sort(), [searchStats]);

  const filteredSearchStats = useMemo(() => {
    let rows = searchStats;
    if (searchModelFilter !== "all") {
      // model filter not directly available in monthly stats, skip for now
    }
    if (selectedEquipTags.length > 0)
      rows = rows.filter(r => selectedEquipTags.includes(r.equipment_name));
    return rows;
  }, [searchStats, searchModelFilter, selectedEquipTags]);

  const pivotEquipment = useMemo(() =>
    [...new Set(filteredSearchStats.map(r => r.equipment_name))].sort(),
    [filteredSearchStats]);

  const pivotRows = useMemo(() =>
    pivotEquipment.map(equip => {
      const entry: Record<string, unknown> = { equip };
      let total = 0;
      searchMonths.forEach(m => {
        const row = filteredSearchStats.find(r => r.equipment_name === equip && r.month === m);
        const val = row?.installed_count ?? 0;
        entry[m] = val;
        total += val;
      });
      entry["total"] = total;
      return entry;
    }).sort((a, b) => (b["total"] as number) - (a["total"] as number)),
    [pivotEquipment, filteredSearchStats, searchMonths]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">ניתוח צריכת אביזרים</h2>
          <p className="text-xs text-muted-foreground mt-0.5">מעקב צריכה חודשית והמלצות רכש</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSynced && (
            <span className="text-xs text-muted-foreground">
              עודכן {format(new Date(lastSynced), "dd/MM HH:mm")}
            </span>
          )}
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="consumption" className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" /> צריכת אביזרים
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-1.5">
            <LineChart className="w-4 h-4" /> דשבורד מכירות
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-1.5">
            <Search className="w-4 h-4" /> חיפוש פריטים
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Consumption ── */}
        <TabsContent value="consumption">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end justify-end">
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs text-muted-foreground">טווח זמן</span>
                  <Select value={monthRange} onValueChange={setMonthRange}>
                    <SelectTrigger className="w-40 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_RANGE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs text-muted-foreground">אביזר</span>
                  <Select value={consumptionEquipFilter} onValueChange={setConsumptionEquipFilter}>
                    <SelectTrigger className="w-56 text-sm">
                      <SelectValue placeholder="כל האביזרים" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל האביזרים</SelectItem>
                      {allEquipment.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bar chart */}
          {loadingMonthly ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">טוען...</div>
          ) : barChartData.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground border rounded-lg">
              אין נתונים לתקופה הנבחרת
            </div>
          ) : (
            <Card className="mb-4">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-4 text-right">פרטו צריכה לפי אביזר ולפי חודש</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barChartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="equipment"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [value, hebrewMonth(name)]}
                      labelStyle={{ direction: "rtl" }}
                    />
                    <Legend
                      formatter={(value) => hebrewMonth(value)}
                      wrapperStyle={{ direction: "rtl", fontSize: 12 }}
                    />
                    {allMonths.map((m, i) => (
                      <Bar key={m} dataKey={m} stackId="a" fill={MONTH_COLORS[i % MONTH_COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Summary table */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs"
                  onClick={() => exportCsv(summaryRows.map(r => ({
                    "אביזר": r.equipment,
                    'סה"כ': r.total,
                    "ממוצע חודשי": r.monthly.toFixed(1),
                    "ממוצע 3 חודשים": r.avg3.toFixed(1),
                  })), "frisbee-consumption.csv")}
                >
                  <Download className="w-3.5 h-3.5" /> ייצוא לאקסל
                </Button>
                <h3 className="text-sm font-semibold">סיכום לפי אביזר</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(consumptionColVis.hiddenCols, setConsumMenu)}>
                      {CONSUMPTION_COLS.map(col => consumptionColVis.isVisible(col.id) ? (
                        <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setConsumMenu)}>
                          {col.label}
                        </th>
                      ) : null)}
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.length === 0 ? (
                      <tr>
                        <td colSpan={consumptionColVis.visibleCount} className="text-center py-8 text-muted-foreground text-sm">
                          אין נתונים
                        </td>
                      </tr>
                    ) : summaryRows.map(row => (
                      <tr key={row.equipment} className="border-b last:border-0 hover:bg-muted/20">
                        {consumptionColVis.isVisible("equipment") && (
                          <td className="p-3 font-medium">{row.equipment}</td>
                        )}
                        {consumptionColVis.isVisible("total") && (
                          <td className="p-3 font-mono font-bold text-primary">{row.total.toLocaleString()}</td>
                        )}
                        {consumptionColVis.isVisible("monthly") && (
                          <td className="p-3 font-mono">{row.monthly.toFixed(1)}</td>
                        )}
                        {consumptionColVis.isVisible("avg3") && (
                          <td className="p-3 font-mono font-semibold text-purple-600">{row.avg3.toFixed(1)}</td>
                        )}
                        {consumptionColVis.isVisible("trend") && (
                          <td className="p-3"><TrendIcon dir={row.trend} /></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Sales Dashboard ── */}
        <TabsContent value="sales">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end justify-end">
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs text-muted-foreground">טווח זמן</span>
                  <Select value={salesMonthRange} onValueChange={setSalesMonthRange}>
                    <SelectTrigger className="w-36 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_RANGE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs text-muted-foreground">יצרן</span>
                  <Select value={salesManufacturerFilter} onValueChange={setSalesManufacturerFilter}>
                    <SelectTrigger className="w-40 text-sm">
                      <SelectValue placeholder="כל היצרנים" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל היצרנים</SelectItem>
                      {allManufacturers.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs text-muted-foreground">אביזר ספציפי</span>
                  <Select value={salesEquipFilter} onValueChange={setSalesEquipFilter}>
                    <SelectTrigger className="w-56 text-sm">
                      <SelectValue placeholder="כל האביזרים" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל האביזרים</SelectItem>
                      {allEquipment.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI cards */}
          {loadingModels ? (
            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">טוען...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-orange-700 mb-1">הכי הרבה אביזרים לרכב</p>
                    <p className="text-xl font-bold text-orange-800">{maxModel?.model ?? "—"}</p>
                    <p className="text-sm text-orange-600 mt-0.5">ממוצע {maxModel?.avg_per_vehicle.toFixed(1) ?? "—"}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-purple-700 mb-1">דגם מוביל</p>
                    <p className="text-xl font-bold text-purple-800">{topModelByInspections?.model ?? "—"}</p>
                    <p className="text-sm text-purple-600 mt-0.5">{topModelByInspections?.inspection_count.toLocaleString() ?? "—"} בדיקות</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-green-700 mb-1">ממוצע אביזרים לרכב</p>
                    <p className="text-3xl font-bold text-green-800">{overallAvg.toFixed(1)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-blue-700 mb-1">הכי מעט אביזרים לרכב</p>
                    <p className="text-xl font-bold text-blue-800">{minModel?.model ?? "—"}</p>
                    <p className="text-sm text-blue-600 mt-0.5">ממוצע {minModel?.avg_per_vehicle.toFixed(1) ?? "—"}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground cursor-pointer">↗</span>
                      <h3 className="text-sm font-semibold">פילוח אביזרים מובילים</h3>
                    </div>
                    {pieData.length === 0 ? (
                      <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">אין נתונים</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                            labelLine={false}
                            fontSize={11}
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => [v, "כמות"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground cursor-pointer">↗</span>
                      <h3 className="text-sm font-semibold">ממוצע אביזרים לרכב לפי דגם (Top 8)</h3>
                    </div>
                    {modelBarData.length === 0 ? (
                      <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">אין נתונים</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={modelBarData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="model" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => [v, "ממוצע לרכב"]} />
                          <Bar dataKey="avg" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Model breakdown table */}
              <Card>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 pb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 text-xs"
                      onClick={() => exportCsv(filteredModels.map(r => ({
                        "יצרן": r.manufacturer,
                        "דגם": r.model,
                        "בדיקות": r.inspection_count,
                        'סה"כ אביזרים': r.total_accessories,
                        "ממוצע לרכב": r.avg_per_vehicle.toFixed(2),
                      })), "frisbee-models.csv")}
                    >
                      <Download className="w-3.5 h-3.5" /> ייצוא לאקסל
                    </Button>
                    <h3 className="text-sm font-semibold">פילוח לפי דגם רכב</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(modelColVis.hiddenCols, setModelMenu)}>
                          {MODEL_COLS.map(col => modelColVis.isVisible(col.id) ? (
                            <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setModelMenu)}>
                              {col.label}
                            </th>
                          ) : null)}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModels.length === 0 ? (
                          <tr>
                            <td colSpan={modelColVis.visibleCount} className="text-center py-8 text-muted-foreground">
                              אין נתונים
                            </td>
                          </tr>
                        ) : filteredModels.map((row, idx) => {
                          const prevRows = filteredModels.slice(0, idx);
                          const prevAvg = prevRows.length
                            ? prevRows.reduce((s, r) => s + r.avg_per_vehicle, 0) / prevRows.length
                            : null;
                          const trendDir: TrendDir = prevAvg === null ? "flat"
                            : row.avg_per_vehicle > prevAvg * 1.05 ? "up"
                            : row.avg_per_vehicle < prevAvg * 0.95 ? "down"
                            : "flat";
                          return (
                            <tr key={`${row.manufacturer}-${row.model}-${idx}`} className="border-b last:border-0 hover:bg-muted/20">
                              {modelColVis.isVisible("manufacturer") && (
                                <td className="p-3">{row.manufacturer}</td>
                              )}
                              {modelColVis.isVisible("model") && (
                                <td className="p-3 font-medium">{row.model}</td>
                              )}
                              {modelColVis.isVisible("inspections") && (
                                <td className="p-3 font-mono font-bold text-primary">{row.inspection_count.toLocaleString()}</td>
                              )}
                              {modelColVis.isVisible("total") && (
                                <td className="p-3 font-mono">{row.total_accessories.toLocaleString()}</td>
                              )}
                              {modelColVis.isVisible("avg") && (
                                <td className="p-3 font-mono font-semibold text-green-700">{row.avg_per_vehicle.toFixed(1)}</td>
                              )}
                              {modelColVis.isVisible("trend") && (
                                <td className="p-3"><TrendIcon dir={trendDir} /></td>
                              )}
                              {modelColVis.isVisible("top") && (
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(row.top_accessories ?? []).map((ta, ti) => (
                                      <Badge key={ti} variant="secondary" className="text-xs">
                                        {ta.name} ({ta.count})
                                      </Badge>
                                    ))}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Tab 3: Item Search ── */}
        <TabsContent value="search">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end justify-end">
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs text-muted-foreground">דגם רכב</span>
                  <Select value={searchModelFilter} onValueChange={setSearchModelFilter}>
                    <SelectTrigger className="w-44 text-sm">
                      <SelectValue placeholder="כל הדגמים" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל הדגמים</SelectItem>
                      {allModels.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs text-muted-foreground">עד תאריך</span>
                  <input
                    type="date"
                    value={searchDateTo}
                    onChange={e => setSearchDateTo(e.target.value)}
                    className="border rounded-md px-3 py-1.5 text-sm bg-background"
                  />
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs text-muted-foreground">מתאריך</span>
                  <input
                    type="date"
                    value={searchDateFrom}
                    onChange={e => setSearchDateFrom(e.target.value)}
                    className="border rounded-md px-3 py-1.5 text-sm bg-background"
                  />
                </div>
              </div>

              {/* Accessory tag filter */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2 justify-end">
                  <span className="text-xs text-muted-foreground">בחר פריטים (ריק = כולם)</span>
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  placeholder="חפש פריט..."
                  value={searchEquipInput}
                  onChange={e => setSearchEquipInput(e.target.value)}
                  className="w-full border rounded-md px-3 py-1.5 text-sm bg-background mb-2 text-right"
                />
                <div className="flex flex-wrap gap-1.5">
                  {searchEquipNames
                    .filter(e => !searchEquipInput || e.toLowerCase().includes(searchEquipInput.toLowerCase()))
                    .map(equip => {
                      const active = selectedEquipTags.includes(equip);
                      return (
                        <button
                          key={equip}
                          onClick={() => setSelectedEquipTags(prev =>
                            active ? prev.filter(t => t !== equip) : [...prev, equip]
                          )}
                          className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:border-primary/50"
                          }`}
                        >
                          {equip}
                        </button>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pivot table */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs"
                  onClick={() => exportCsv(pivotRows.map(r => {
                    const out: Record<string, unknown> = { "פריט": r.equip };
                    searchMonths.forEach(m => { out[hebrewMonth(m)] = r[m] ?? 0; });
                    out['סה"כ'] = r["total"];
                    return out;
                  }), "frisbee-search.csv")}
                >
                  <Download className="w-3.5 h-3.5" /> ייצוא לאקסל
                </Button>
                <h3 className="text-sm font-semibold">
                  פירוט לפי פריט ({pivotEquipment.length} פריטים)
                </h3>
              </div>
              {loadingSearch ? (
                <div className="py-12 text-center text-sm text-muted-foreground">טוען...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-right p-3 font-semibold text-foreground">פריט</th>
                        {searchMonths.map(m => (
                          <th key={m} className="text-left p-3 font-semibold text-foreground whitespace-nowrap">
                            {hebrewMonth(m)}
                          </th>
                        ))}
                        <th className="text-left p-3 font-semibold text-primary whitespace-nowrap">סה"כ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pivotRows.length === 0 ? (
                        <tr>
                          <td colSpan={searchMonths.length + 2} className="text-center py-8 text-muted-foreground">
                            אין נתונים
                          </td>
                        </tr>
                      ) : pivotRows.map(row => (
                        <tr key={String(row.equip)} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="p-3 font-medium">{String(row.equip)}</td>
                          {searchMonths.map(m => (
                            <td key={m} className={`p-3 font-mono ${Number(row[m]) > 0 ? "" : "text-muted-foreground"}`}>
                              {Number(row[m]) > 0 ? row[m] : 0}
                            </td>
                          ))}
                          <td className="p-3 font-mono font-bold text-primary">{row["total"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Context menus */}
      {consumMenu && (
        <ColContextMenu
          menu={consumMenu}
          sortField={undefined}
          sortDir={undefined}
          hiddenCols={consumptionColVis.hiddenCols}
          onClose={closeConsumMenu}
          onHide={consumptionColVis.hide}
          onShow={consumptionColVis.show}
          onSortAsc={() => {}}
          onSortDesc={() => {}}
        />
      )}
      {modelMenu && (
        <ColContextMenu
          menu={modelMenu}
          sortField={undefined}
          sortDir={undefined}
          hiddenCols={modelColVis.hiddenCols}
          onClose={closeModelMenu}
          onHide={modelColVis.hide}
          onShow={modelColVis.show}
          onSortAsc={() => {}}
          onSortDesc={() => {}}
        />
      )}
    </div>
  );
}
