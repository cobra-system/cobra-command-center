import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Boxes, Plus, UserPlus, Package, PackageX, TrendingDown, AlertTriangle } from "lucide-react";
import { NewInstallerDialog } from "@/components/equipment/NewInstallerDialog";
import { NewPickupDialog } from "@/components/equipment/NewPickupDialog";
import { NewReturnDialog } from "@/components/equipment/NewReturnDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Installer {
  id: string;
  name: string;
  warehouse_number: number | null;
  division: string;
  status: string;
  coordinator: string | null;
}

interface PickupWithItems {
  id: string;
  installer_id: string;
  pickup_date: string;
  equipment_pickup_items: { quantity: number }[];
}

interface ReturnWithItems {
  id: string;
  installer_id: string;
  return_date: string;
  equipment_return_items: {
    quantity: number;
    reason: string;
    is_actually_faulty: boolean | null;
    product_id: string;
  }[];
}

interface ReturnItemFlat {
  return_date: string;
  installer_id: string;
  installer_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  reason: string;
  sticker_label: string | null;
  is_actually_faulty: boolean | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function returnPctColor(pct: number) {
  if (pct <= 5) return "text-green-600";
  if (pct <= 15) return "text-yellow-600";
  return "text-red-600";
}

function returnPctBg(pct: number) {
  if (pct <= 5) return "bg-green-100 text-green-700";
  if (pct <= 15) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function barColor(pct: number) {
  if (pct <= 5) return "#16a34a";
  if (pct <= 15) return "#ca8a04";
  return "#dc2626";
}

const PIE_COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4"];

const DIVISIONS = ["הכל", "AWACS", "כפתור", "DOORE"];

function monthLabel(date: Date) {
  return format(date, "MM/yyyy");
}

// Build list of last N months
function buildMonthOptions(n = 12) {
  const opts = [];
  for (let i = 0; i < n; i++) {
    const d = subMonths(new Date(), i);
    opts.push({ value: monthLabel(d), date: startOfMonth(d) });
  }
  return opts;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const navigate = useNavigate();
  const { products } = useData();

  // ── Tab 1 state ──
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [pickups, setPickups] = useState<PickupWithItems[]>([]);
  const [returns, setReturns] = useState<ReturnWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const monthOptions = useMemo(() => buildMonthOptions(12), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [selectedDivision, setSelectedDivision] = useState("הכל");

  // ── Dialogs ──
  const [showNewInstaller, setShowNewInstaller] = useState(false);
  const [showNewPickup, setShowNewPickup] = useState(false);
  const [showNewReturn, setShowNewReturn] = useState(false);

  // ── Tab 2 (dashboard) state ──
  const [dashDivision, setDashDivision] = useState("הכל");
  const [dashMonths, setDashMonths] = useState("1"); // months back

  // Product lookup map
  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [products]);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, pickRes, retRes] = await Promise.all([
        supabase.from("installers").select("*").order("name"),
        supabase
          .from("equipment_pickups")
          .select("id, installer_id, pickup_date, equipment_pickup_items(quantity)"),
        supabase
          .from("equipment_returns")
          .select(
            "id, installer_id, return_date, equipment_return_items(quantity, reason, is_actually_faulty, product_id)"
          ),
      ]);
      if (instRes.error) throw instRes.error;
      if (pickRes.error) throw pickRes.error;
      if (retRes.error) throw retRes.error;
      setInstallers((instRes.data ?? []) as Installer[]);
      setPickups((pickRes.data ?? []) as PickupWithItems[]);
      setReturns((retRes.data ?? []) as ReturnWithItems[]);
    } catch (err) {
      toast.error("שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Tab 1 computations ───────────────────────────────────────────────────

  const selectedMonthDate = useMemo(
    () => monthOptions.find((m) => m.value === selectedMonth)?.date ?? new Date(),
    [selectedMonth, monthOptions]
  );

  const filteredInstallers = useMemo(() => {
    if (selectedDivision === "הכל") return installers;
    return installers.filter((i) => i.division === selectedDivision);
  }, [installers, selectedDivision]);

  const installerStats = useMemo(() => {
    const start = startOfMonth(selectedMonthDate).toISOString().split("T")[0];
    const end = endOfMonth(selectedMonthDate).toISOString().split("T")[0];

    return filteredInstallers.map((inst) => {
      const instPickups = pickups.filter(
        (p) => p.installer_id === inst.id && p.pickup_date >= start && p.pickup_date <= end
      );
      const instReturns = returns.filter(
        (r) => r.installer_id === inst.id && r.return_date >= start && r.return_date <= end
      );
      const taken = instPickups.reduce(
        (sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0),
        0
      );
      const returned = instReturns.reduce(
        (sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0),
        0
      );
      const pct = taken > 0 ? Math.round((returned / taken) * 100) : 0;
      const lastPickup =
        instPickups.length > 0
          ? instPickups.sort((a, b) => b.pickup_date.localeCompare(a.pickup_date))[0].pickup_date
          : null;
      return { ...inst, pickupCount: instPickups.length, taken, returned, pct, lastPickup };
    }).sort((a, b) => b.pct - a.pct);
  }, [filteredInstallers, pickups, returns, selectedMonthDate]);

  // ─── Tab 2 computations ───────────────────────────────────────────────────

  const dashStartDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(dashMonths));
    return startOfDay(d).toISOString().split("T")[0];
  }, [dashMonths]);

  const dashInstallers = useMemo(() => {
    if (dashDivision === "הכל") return installers;
    return installers.filter((i) => i.division === dashDivision);
  }, [installers, dashDivision]);
  const dashInstallerIds = useMemo(
    () => new Set(dashInstallers.map((i) => i.id)),
    [dashInstallers]
  );

  const dashPickups = useMemo(
    () => pickups.filter((p) => dashInstallerIds.has(p.installer_id) && p.pickup_date >= dashStartDate),
    [pickups, dashInstallerIds, dashStartDate]
  );
  const dashReturns = useMemo(
    () => returns.filter((r) => dashInstallerIds.has(r.installer_id) && r.return_date >= dashStartDate),
    [returns, dashInstallerIds, dashStartDate]
  );

  const totalTaken = useMemo(
    () => dashPickups.reduce((sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0), 0),
    [dashPickups]
  );
  const totalReturned = useMemo(
    () => dashReturns.reduce((sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0), 0),
    [dashReturns]
  );
  const overallPct = totalTaken > 0 ? Math.round((totalReturned / totalTaken) * 100) : 0;
  const wasteCount = useMemo(
    () =>
      dashReturns.reduce(
        (sum, r) =>
          sum +
          r.equipment_return_items
            .filter((i) => i.is_actually_faulty === false)
            .reduce((s, i) => s + i.quantity, 0),
        0
      ),
    [dashReturns]
  );

  // Chart 1: return % by installer (horizontal bar)
  const chartByInstaller = useMemo(() => {
    return dashInstallers
      .map((inst) => {
        const taken = dashPickups
          .filter((p) => p.installer_id === inst.id)
          .reduce((sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0), 0);
        const returned = dashReturns
          .filter((r) => r.installer_id === inst.id)
          .reduce((sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0), 0);
        const pct = taken > 0 ? Math.round((returned / taken) * 100) : 0;
        return { name: inst.name, pct, fill: barColor(pct) };
      })
      .filter((d) => d.pct > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [dashInstallers, dashPickups, dashReturns]);

  // Chart 2: return reasons (pie)
  const chartByReason = useMemo(() => {
    const map = new Map<string, number>();
    dashReturns.forEach((r) =>
      r.equipment_return_items.forEach((item) => {
        map.set(item.reason, (map.get(item.reason) ?? 0) + item.quantity);
      })
    );
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [dashReturns]);

  // Chart 3: returns by product top-10 (vertical bar)
  const chartByProduct = useMemo(() => {
    const map = new Map<string, number>();
    dashReturns.forEach((r) =>
      r.equipment_return_items.forEach((item) => {
        const name = productMap.get(item.product_id) ?? item.product_id;
        map.set(name, (map.get(name) ?? 0) + item.quantity);
      })
    );
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [dashReturns, productMap]);

  // Chart 4: monthly trend by division
  const chartMonthlyTrend = useMemo(() => {
    const months = buildMonthOptions(6).reverse();
    return months.map(({ value, date }) => {
      const start = startOfMonth(date).toISOString().split("T")[0];
      const end = endOfMonth(date).toISOString().split("T")[0];
      const row: Record<string, number | string> = { month: value };
      ["AWACS", "כפתור", "DOORE", "כולל"].forEach((div) => {
        const instIds =
          div === "כולל"
            ? new Set(installers.map((i) => i.id))
            : new Set(installers.filter((i) => i.division === div).map((i) => i.id));
        const taken = pickups
          .filter((p) => instIds.has(p.installer_id) && p.pickup_date >= start && p.pickup_date <= end)
          .reduce((sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0), 0);
        const ret = returns
          .filter((r) => instIds.has(r.installer_id) && r.return_date >= start && r.return_date <= end)
          .reduce((sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0), 0);
        row[div] = taken > 0 ? Math.round((ret / taken) * 100) : 0;
      });
      return row;
    });
  }, [installers, pickups, returns]);

  // Waste table items (is_actually_faulty = false)
  const wasteItems = useMemo((): ReturnItemFlat[] => {
    const rows: ReturnItemFlat[] = [];
    const installerMap = new Map(installers.map((i) => [i.id, i.name]));
    dashReturns.forEach((r) => {
      r.equipment_return_items
        .filter((item) => item.is_actually_faulty === false)
        .forEach((item) => {
          rows.push({
            return_date: r.return_date,
            installer_id: r.installer_id,
            installer_name: installerMap.get(r.installer_id) ?? r.installer_id,
            product_id: item.product_id,
            product_name: productMap.get(item.product_id) ?? item.product_id,
            quantity: item.quantity,
            reason: item.reason,
            sticker_label: null,
            is_actually_faulty: false,
          });
        });
    });
    return rows.sort((a, b) => b.return_date.localeCompare(a.return_date));
  }, [dashReturns, installers, productMap]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Boxes className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-bold">הצטיידויות ובלאי</h1>
      </div>

      <Tabs defaultValue="tracking">
        <TabsList className="mb-2">
          <TabsTrigger value="tracking">מעקב מתקינים</TabsTrigger>
          <TabsTrigger value="dashboard">לוח בקרה</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════
            TAB 1: מעקב מתקינים
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="tracking" className="space-y-4">
          {/* Action bar */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowNewInstaller(true)}>
                <UserPlus className="h-4 w-4 me-1" />
                מתקין חדש
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewPickup(true)}>
                <Package className="h-4 w-4 me-1" />
                הצטיידות חדשה
              </Button>
              <Button size="sm" onClick={() => setShowNewReturn(true)}>
                <PackageX className="h-4 w-4 me-1" />
                החזרה חדשה
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="h-8 w-28 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Installers table */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : installerStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted/30 rounded-full mb-4">
                <Boxes className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <p className="text-base font-medium text-muted-foreground mb-1">אין מתקינים עדיין</p>
              <p className="text-sm text-muted-foreground/60">לחצו על "מתקין חדש +" כדי להתחיל</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם מתקין</TableHead>
                    <TableHead className="text-center">מחסן</TableHead>
                    <TableHead className="text-center">חטיבה</TableHead>
                    <TableHead className="text-center">הצטיידויות</TableHead>
                    <TableHead className="text-center">נלקחו</TableHead>
                    <TableHead className="text-center">הוחזרו</TableHead>
                    <TableHead className="text-center">אחוז החזרה</TableHead>
                    <TableHead className="text-center hidden md:table-cell">הצטיידות אחרונה</TableHead>
                    <TableHead className="text-center">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installerStats.map((inst) => (
                    <TableRow
                      key={inst.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/equipment/installer/${inst.id}`)}
                    >
                      <TableCell className="font-medium">{inst.name}</TableCell>
                      <TableCell className="text-center">{inst.warehouse_number ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">{inst.division}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{inst.pickupCount}</TableCell>
                      <TableCell className="text-center">{inst.taken}</TableCell>
                      <TableCell className="text-center">{inst.returned}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${returnPctColor(inst.pct)}`}>
                          {inst.taken > 0 ? `${inst.pct}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell text-sm text-muted-foreground">
                        {inst.lastPickup
                          ? format(new Date(inst.lastPickup), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`text-xs ${inst.status === "פעיל" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}`}
                        >
                          {inst.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 2: לוח בקרה
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Dashboard filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">תקופה:</span>
            <Select value={dashMonths} onValueChange={setDashMonths}>
              <SelectTrigger className="h-8 w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">30 יום אחרונים</SelectItem>
                <SelectItem value="3">3 חודשים</SelectItem>
                <SelectItem value="6">6 חודשים</SelectItem>
                <SelectItem value="12">שנה</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dashDivision} onValueChange={setDashDivision}>
              <SelectTrigger className="h-8 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIVISIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* KPI cards */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: "פריטים שיצאו",
                  value: totalTaken,
                  icon: Package,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "פריטים שחזרו",
                  value: totalReturned,
                  icon: PackageX,
                  color: "text-orange-600",
                  bg: "bg-orange-50",
                },
                {
                  label: "אחוז החזרה",
                  value: `${overallPct}%`,
                  icon: TrendingDown,
                  color: overallPct <= 5 ? "text-green-600" : overallPct <= 15 ? "text-yellow-600" : "text-red-600",
                  bg: overallPct <= 5 ? "bg-green-50" : overallPct <= 15 ? "bg-yellow-50" : "bg-red-50",
                },
                {
                  label: 'בזבוז (תקינים שהוחזרו)',
                  value: wasteCount,
                  icon: AlertTriangle,
                  color: "text-red-600",
                  bg: "bg-red-50",
                },
              ].map((kpi) => (
                <Card key={kpi.label} className="border">
                  <CardContent className="p-4">
                    <div className={`inline-flex p-2 rounded-lg ${kpi.bg} mb-2`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight">{kpi.label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Charts grid */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Return % by installer */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm">אחוז החזרה לפי מתקין</h3>
                  {chartByInstaller.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">אין נתונים בתקופה זו</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(200, chartByInstaller.length * 35)}>
                      <BarChart
                        data={chartByInstaller}
                        layout="vertical"
                        margin={{ top: 0, right: 30, left: 60, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={55} />
                        <Tooltip formatter={(v) => [`${v}%`, "אחוז החזרה"]} />
                        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                          {chartByInstaller.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Chart 2: Return reasons pie */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm">סיבות החזרה</h3>
                  {chartByReason.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">אין נתונים בתקופה זו</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={chartByReason}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${Math.round(percent * 100)}%`
                          }
                          labelLine={false}
                        >
                          {chartByReason.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Chart 3: Returns by product */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm">החזרות לפי מוצר (Top 10)</h3>
                  {chartByProduct.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">אין נתונים בתקופה זו</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={chartByProduct} margin={{ top: 0, right: 10, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="כמות" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Chart 4: Monthly trend */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm">מגמת החזרות חודשית (%)</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartMonthlyTrend} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v}%`]} />
                      <Legend />
                      <Line type="monotone" dataKey="AWACS" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="כפתור" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="DOORE" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="כולל" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Waste table */}
          {!loading && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  פריטים שהוחזרו ונמצאו תקינים — הבזבוז
                </h3>
                {wasteItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    אין פריטים כאלה בתקופה זו ✅
                  </p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>תאריך</TableHead>
                          <TableHead>מתקין</TableHead>
                          <TableHead>מוצר</TableHead>
                          <TableHead className="text-center">כמות</TableHead>
                          <TableHead>סיבה שנרשמה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wasteItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">
                              {format(new Date(item.return_date), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="font-medium">{item.installer_name}</TableCell>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{item.reason}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NewInstallerDialog
        open={showNewInstaller}
        onOpenChange={setShowNewInstaller}
        onCreated={fetchData}
      />
      <NewPickupDialog
        open={showNewPickup}
        onOpenChange={setShowNewPickup}
        onCreated={fetchData}
      />
      <NewReturnDialog
        open={showNewReturn}
        onOpenChange={setShowNewReturn}
        onCreated={fetchData}
      />
    </div>
  );
}
