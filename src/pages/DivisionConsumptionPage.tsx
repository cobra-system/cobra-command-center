import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData, categories } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, Package, TrendingDown, TrendingUp, Minus,
  ShoppingCart, RefreshCw, Activity, AlertTriangle, Search,
  ArrowUpDown, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { DivisionDashboard } from "@/components/frisbee/DivisionDashboard";
import { DIVISION_COLORS, BONDED_DIVISIONS } from "@/components/equipment/constants";
import { useDivisionConsumption, type ProductConsumptionSummary } from "@/hooks/useDivisionConsumption";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import {
  ColContextMenu, useColMenu, colThContextMenu, trContextMenu,
} from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import type { SortDir } from "@/lib/sortUtils";

const FRISBEE_BASE44_BRANCHES: Record<string, string> = {
  "פריזבי קרסו": "68fa0cbd274acbfa7b159523",
  "לובינסקי": "lubinski",
};

const SYNC_FUNCTION: Record<string, string> = {
  "פריזבי קרסו": "sync-frisbee",
  "לובינסקי":    "sync-lubinski",
};

const SYNC_THROTTLE_MS = 5 * 60 * 1000;

interface OrderRequest { id: string; status: string }

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

const HEBREW_MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

function hebrewMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${HEBREW_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function TrendIcon({ dir }: { dir: "up" | "down" | "flat" }) {
  if (dir === "up") return <TrendingUp className="w-4 h-4 text-green-600" />;
  if (dir === "down") return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function MiniSparkline({ data, maxHeight = 24 }: { data: number[]; maxHeight?: number }) {
  const max = Math.max(...data, 1);
  const width = data.length * 6;
  return (
    <svg width={width} height={maxHeight} className="inline-block" viewBox={`0 0 ${width} ${maxHeight}`}>
      {data.map((v, i) => {
        const h = (v / max) * (maxHeight - 2);
        return (
          <rect
            key={i}
            x={i * 6}
            y={maxHeight - h - 1}
            width={4}
            height={Math.max(h, 1)}
            rx={1}
            fill={v > 0 ? "#3b82f6" : "#e5e7eb"}
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}

function HealthDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ─── Column Definitions ──────────────────────────────────────────────────────

type SortField = "name" | "division_stock" | "monthly_avg" | "quarterly_demand" | "main_stock" | "total" | "avg3" | "health";

const COLUMN_DEFS: ColDef[] = [
  { id: "name", label: "מוצר", sortField: "name" },
  { id: "health", label: "בריאות מלאי", sortField: "health" },
  { id: "division_stock", label: "מלאי בשטח", sortField: "division_stock" },
  { id: "monthly_avg", label: "ממוצע חודשי", sortField: "monthly_avg" },
  { id: "quarterly_demand", label: "דרישה רבעונית", sortField: "quarterly_demand" },
  { id: "main_stock", label: "מלאי מרכזי", sortField: "main_stock" },
  { id: "total", label: 'סה"כ צריכה', sortField: "total" },
  { id: "avg3", label: "ממוצע 3 חודשים", sortField: "avg3" },
  { id: "trend", label: "מגמה" },
  { id: "sparkline", label: "צריכה חודשית" },
];

const CHART_COLORS = [
  "#1e3a5f", "#2563eb", "#38bdf8", "#7c3aed", "#06b6d4",
  "#0891b2", "#1d4ed8", "#6d28d9", "#0e7490", "#1e40af",
  "#4f46e5", "#a78bfa",
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DivisionConsumptionPage() {
  const { divisionName } = useParams<{ divisionName: string }>();
  const navigate = useNavigate();
  const { products: allProducts } = useData();
  const division = divisionName ? decodeURIComponent(divisionName) : "";

  useEffect(() => {
    if (division && !BONDED_DIVISIONS.has(division)) {
      navigate(`/equipment/division/${encodeURIComponent(division)}`, { replace: true });
    }
  }, [division, navigate]);

  // ── Consumption data ──
  const {
    divisionProducts, productSummaries, monthlyTotals,
    allMonths, loading: consumptionLoading,
  } = useDivisionConsumption(division);

  // ── Order requests ──
  const [orderRequests, setOrderRequests] = useState<OrderRequest[]>([]);
  const [frisbeeLastSynced, setFrisbeeLastSynced] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const syncTriggered = useRef(false);

  const fetchLastSynced = useCallback(async (branchId: string) => {
    const { data } = await supabase
      .from("frisbee_equipment_consumption")
      .select("last_synced_at")
      .eq("base44_branch_id", branchId)
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .single();
    setFrisbeeLastSynced(data?.last_synced_at ?? null);
  }, []);

  useEffect(() => {
    const fnName = SYNC_FUNCTION[division];
    const branchId = FRISBEE_BASE44_BRANCHES[division];
    if (!fnName || !branchId || syncTriggered.current) return;
    syncTriggered.current = true;
    supabase
      .from("frisbee_equipment_consumption")
      .select("last_synced_at")
      .eq("base44_branch_id", branchId)
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        const lastSynced = data?.last_synced_at ? new Date(data.last_synced_at).getTime() : 0;
        if (Date.now() - lastSynced < SYNC_THROTTLE_MS) return;
        setSyncing(true);
        supabase.functions.invoke(fnName).then(() => {
          setSyncing(false);
          setSyncVersion((v) => v + 1);
          fetchLastSynced(branchId);
        }).catch(() => setSyncing(false));
      });
  }, [division, fetchLastSynced]);

  useEffect(() => {
    if (!division) return;
    supabase.from("order_requests").select("id, status").eq("division", division)
      .then(({ data }) => setOrderRequests((data ?? []) as OrderRequest[]));
    const branchId = FRISBEE_BASE44_BRANCHES[division];
    if (branchId) fetchLastSynced(branchId);
  }, [division, fetchLastSynced]);

  // ── Computed KPIs ──
  const totalDivisionStock = useMemo(
    () => divisionProducts.reduce((s, dp) => s + (dp.division_stock ?? 0), 0),
    [divisionProducts]
  );
  const totalMonthlyAvg = useMemo(
    () => divisionProducts.reduce((s, dp) => s + (Number(dp.monthly_avg) || 0), 0),
    [divisionProducts]
  );
  const totalQuarterlyDemand = useMemo(
    () => divisionProducts.reduce((s, dp) => s + (dp.quarterly_demand ?? 0), 0),
    [divisionProducts]
  );
  const pendingOrdersCount = useMemo(
    () => orderRequests.filter((r) => r.status === "pending").length,
    [orderRequests]
  );
  const criticalCount = useMemo(
    () => productSummaries.filter(p => p.healthRatio !== null && p.healthRatio < 1).length,
    [productSummaries]
  );

  // ── Table state ──
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField | null>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "division-consumption:hidden-columns",
    COLUMN_DEFS,
    []
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const categoryMap = useMemo(
    () => new Map((categories ?? []).map(c => [c.id, c.name])),
    [categories]
  );

  const filteredSorted = useMemo(() => {
    let items = productSummaries.filter(p => p.total > 0 || p.division_stock > 0);

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    }

    if (sortField) {
      items = [...items].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "name": cmp = a.name.localeCompare(b.name, "he"); break;
          case "division_stock": cmp = a.division_stock - b.division_stock; break;
          case "monthly_avg": cmp = (a.monthly_avg ?? 0) - (b.monthly_avg ?? 0); break;
          case "quarterly_demand": cmp = (a.quarterly_demand ?? 0) - (b.quarterly_demand ?? 0); break;
          case "main_stock": cmp = (a.main_stock ?? 0) - (b.main_stock ?? 0); break;
          case "total": cmp = a.total - b.total; break;
          case "avg3": cmp = a.avg3 - b.avg3; break;
          case "health": cmp = (a.healthRatio ?? -1) - (b.healthRatio ?? -1); break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return items;
  }, [productSummaries, searchTerm, sortField, sortDir]);

  const colorClass = DIVISION_COLORS[division] ?? "border-border text-muted-foreground bg-muted/40";
  const frisbeeBranchId = FRISBEE_BASE44_BRANCHES[division] ?? null;

  if (consumptionLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>{division}</Badge>
          <h1 className="text-lg font-semibold text-foreground">ניתוח צריכה ובריאות מלאי</h1>
        </div>
        <div className="flex items-center gap-2">
          {syncing && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              מסנכרן…
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "מוצרים פעילים",
            value: divisionProducts.length,
            icon: Package,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-950/30",
          },
          {
            label: "מלאי בשטח",
            value: fmtNum(totalDivisionStock),
            icon: Package,
            color: "text-indigo-600",
            bg: "bg-indigo-50 dark:bg-indigo-950/30",
          },
          {
            label: "ממוצע צריכה חודשי",
            value: fmtNum(totalMonthlyAvg),
            icon: Activity,
            color: "text-purple-600",
            bg: "bg-purple-50 dark:bg-purple-950/30",
          },
          {
            label: "דרישה רבעונית",
            value: fmtNum(totalQuarterlyDemand),
            icon: BarChart3,
            color: "text-cyan-600",
            bg: "bg-cyan-50 dark:bg-cyan-950/30",
          },
          {
            label: "מוצרים קריטיים",
            value: criticalCount,
            icon: AlertTriangle,
            color: criticalCount > 0 ? "text-red-600" : "text-green-600",
            bg: criticalCount > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-green-50 dark:bg-green-950/30",
          },
          {
            label: "בקשות ממתינות",
            value: pendingOrdersCount,
            icon: ShoppingCart,
            color: pendingOrdersCount > 0 ? "text-amber-600" : "text-green-600",
            bg: pendingOrdersCount > 0 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-green-50 dark:bg-green-950/30",
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className={`inline-flex p-1.5 rounded-lg ${kpi.bg} mb-2`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">{kpi.label}</p>
              <p className={`text-xl font-bold mt-0.5 tabular-nums ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Monthly Consumption Chart ── */}
      {monthlyTotals.length > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="p-4 pt-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">צריכה חודשית כוללת</h2>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTotals} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={hebrewMonth}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    labelFormatter={hebrewMonth}
                    formatter={(value: number) => [fmtNum(value), 'סה"כ יחידות']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {monthlyTotals.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Frisbee analytics (only for branches with Base44 integration) ── */}
      {frisbeeBranchId && (
        <DivisionDashboard
          key={syncVersion}
          branchId={frisbeeBranchId}
          division={division}
          lastSynced={frisbeeLastSynced}
        />
      )}

      {/* ── Product Consumption Table ── */}
      {filteredSorted.length > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 pb-3 border-b">
              <h2 className="text-sm font-semibold text-foreground">פירוט צריכה ובריאות מלאי</h2>
              <div className="relative w-56">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="חיפוש מוצר..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-9 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b bg-muted/50"
                    onContextMenu={trContextMenu(hiddenCols, setColMenu)}
                  >
                    {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                      <th
                        key={col.id}
                        className="text-right p-3 font-semibold text-foreground whitespace-nowrap"
                        onContextMenu={colThContextMenu(col, setColMenu)}
                      >
                        {col.sortField ? (
                          <button
                            onClick={() => toggleSort(col.sortField as SortField)}
                            className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                          >
                            {col.label} <SortIcon field={col.sortField as SortField} />
                          </button>
                        ) : col.label}
                      </th>
                    ) : null)}
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map(p => (
                    <tr
                      key={p.product_id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/products/${p.product_id}`)}
                    >
                      {isVisible("name") && (
                        <td className="p-3">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="font-mono">{p.sku}</span>
                            {p.category_id && categoryMap.has(p.category_id) && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span>{String(categoryMap.get(p.category_id))}</span>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible("health") && (
                        <td className="p-3">
                          <HealthDot color={p.healthColor} label={p.healthLabel} />
                          {p.healthRatio !== null && (
                            <span className="text-[10px] text-muted-foreground mr-1">
                              ({fmtNum(p.healthRatio)} חודשים)
                            </span>
                          )}
                        </td>
                      )}
                      {isVisible("division_stock") && (
                        <td className="p-3 tabular-nums font-medium">{fmtNum(p.division_stock)}</td>
                      )}
                      {isVisible("monthly_avg") && (
                        <td className="p-3 tabular-nums">{fmtNum(p.monthly_avg)}</td>
                      )}
                      {isVisible("quarterly_demand") && (
                        <td className="p-3 tabular-nums">{fmtNum(p.quarterly_demand)}</td>
                      )}
                      {isVisible("main_stock") && (
                        <td className="p-3 tabular-nums text-muted-foreground">{fmtNum(p.main_stock)}</td>
                      )}
                      {isVisible("total") && (
                        <td className="p-3 tabular-nums font-semibold">{fmtNum(p.total)}</td>
                      )}
                      {isVisible("avg3") && (
                        <td className="p-3 tabular-nums">{fmtNum(p.avg3)}</td>
                      )}
                      {isVisible("trend") && (
                        <td className="p-3">
                          <TrendIcon dir={p.trend} />
                        </td>
                      )}
                      {isVisible("sparkline") && (
                        <td className="p-3">
                          <MiniSparkline data={p.monthlyData.map(d => d.quantity)} />
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredSorted.length === 0 && (
                    <tr>
                      <td colSpan={visibleCount} className="p-8 text-center text-muted-foreground">
                        לא נמצאו מוצרים תואמים
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Health Legend ── */}
      {productSummaries.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="font-medium text-foreground">מפתח בריאות מלאי:</span>
          {[
            { color: "#16a34a", label: "מצוין (4+ חודשים)" },
            { color: "#4ade80", label: "תקין (3-4)" },
            { color: "#eab308", label: "סביר (2-3)" },
            { color: "#f97316", label: "נמוך (1-2)" },
            { color: "#ef4444", label: "קריטי (<1)" },
            { color: "#dc2626", label: "אזל (0)" },
            { color: "#6b7280", label: "אין נתונים" },
          ].map(h => (
            <span key={h.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color }} />
              {h.label}
            </span>
          ))}
        </div>
      )}

      {/* ── ColContextMenu ── */}
      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => { setSortField(field as SortField); setSortDir("asc"); }}
          onSortDesc={field => { setSortField(field as SortField); setSortDir("desc"); }}
        />
      )}
    </div>
  );
}
