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
import {
  Boxes,
  Package,
  PackageX,
  TrendingDown,
  AlertTriangle,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Users,
  ShoppingBag,
} from "lucide-react";
import { NewInstallerDialog } from "@/components/equipment/NewInstallerDialog";
import { NewPickupDialog } from "@/components/equipment/NewPickupDialog";
import { NewReturnDialog } from "@/components/equipment/NewReturnDialog";
import { DivisionPanel } from "@/components/equipment/DivisionPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Installer {
  id: string;
  name: string;
  warehouse_number: number | null;
  division: string;
  status: string;
  coordinator: string | null;
}

interface PickupItem {
  quantity: number;
  product_id: string;
}

interface PickupWithItems {
  id: string;
  installer_id: string;
  pickup_date: string;
  notes: string | null;
  equipment_pickup_items: PickupItem[];
}

interface ReturnItem {
  quantity: number;
  reason: string;
  is_actually_faulty: boolean | null;
  product_id: string;
}

interface ReturnWithItems {
  id: string;
  installer_id: string;
  return_date: string;
  equipment_return_items: ReturnItem[];
}

interface ReturnItemFlat {
  return_date: string;
  installer_id: string;
  installer_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  reason: string;
  is_actually_faulty: boolean | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function returnPctColor(pct: number) {
  if (pct <= 5) return "text-green-600";
  if (pct <= 15) return "text-yellow-600";
  return "text-red-600";
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

  // ── Shared data state ──
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [pickups, setPickups] = useState<PickupWithItems[]>([]);
  const [returns, setReturns] = useState<ReturnWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const monthOptions = useMemo(() => buildMonthOptions(12), []);

  // ── Tab 1: מעקב מתקינים ──
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [selectedDivision, setSelectedDivision] = useState("הכל");

  // ── Tab 2: מעקב הצטיידויות ──
  const [pickupsMonth, setPickupsMonth] = useState(monthOptions[0].value);
  const [pickupsDivision, setPickupsDivision] = useState("הכל");
  const [expandedPickups, setExpandedPickups] = useState<Set<string>>(new Set());

  // ── Tab 3: לוח בקרה ──
  const [dashDivision, setDashDivision] = useState("הכל");
  const [dashMonths, setDashMonths] = useState("1");

  // ── Division panel ──
  const [divisionPanel, setDivisionPanel] = useState<string | null>(null);

  // ── Dialogs ──
  const [showNewInstaller, setShowNewInstaller] = useState(false);
  const [showNewPickup, setShowNewPickup] = useState(false);
  const [showNewReturn, setShowNewReturn] = useState(false);

  // Product lookup
  const productMap = useMemo(() => {
    const m = new Map<string, { name: string; sku: string | null; category: string | null }>();
    products.forEach((p) =>
      m.set(p.id, { name: p.name, sku: p.sku ?? null, category: p.category ?? null })
    );
    return m;
  }, [products]);

  const productNameMap = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [products]);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, pickRes, retRes] = await Promise.all([
        supabase.from("installers").select("*").order("name"),
        supabase
          .from("equipment_pickups")
          .select(
            "id, installer_id, pickup_date, notes, equipment_pickup_items(quantity, product_id)"
          )
          .order("pickup_date", { ascending: false }),
        supabase
          .from("equipment_returns")
          .select(
            "id, installer_id, return_date, equipment_return_items(quantity, reason, is_actually_faulty, product_id)"
          )
          .order("return_date", { ascending: false }),
      ]);
      if (instRes.error) throw instRes.error;
      if (pickRes.error) throw pickRes.error;
      if (retRes.error) throw retRes.error;
      setInstallers((instRes.data ?? []) as Installer[]);
      setPickups((pickRes.data ?? []) as PickupWithItems[]);
      setReturns((retRes.data ?? []) as ReturnWithItems[]);
    } catch {
      toast.error("שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Tab 1: Installer stats ────────────────────────────────────────────────

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
    return filteredInstallers
      .map((inst) => {
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
            ? instPickups.reduce((latest, p) =>
                p.pickup_date > latest.pickup_date ? p : latest
              ).pickup_date
            : null;
        return { ...inst, pickupCount: instPickups.length, taken, returned, pct, lastPickup };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [filteredInstallers, pickups, returns, selectedMonthDate]);

  // ─── Tab 2: Equipment tracking (pickup-centric) ───────────────────────────

  const pickupsMonthDate = useMemo(
    () => monthOptions.find((m) => m.value === pickupsMonth)?.date ?? new Date(),
    [pickupsMonth, monthOptions]
  );

  const installerMap = useMemo(
    () => new Map(installers.map((i) => [i.id, i])),
    [installers]
  );

  const filteredPickupEvents = useMemo(() => {
    const start = startOfMonth(pickupsMonthDate).toISOString().split("T")[0];
    const end = endOfMonth(pickupsMonthDate).toISOString().split("T")[0];

    return pickups
      .filter((p) => {
        if (p.pickup_date < start || p.pickup_date > end) return false;
        if (pickupsDivision === "הכל") return true;
        return installerMap.get(p.installer_id)?.division === pickupsDivision;
      })
      .map((p) => {
        const inst = installerMap.get(p.installer_id);
        const totalTaken = p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0);

        // Find returns from this installer on or after pickup date (within a loose window)
        const installerReturns = returns.filter(
          (r) => r.installer_id === p.installer_id && r.return_date >= p.pickup_date
        );

        // Build product-level return map for items in this pickup
        const returnsByProduct = new Map<string, number>();
        installerReturns.forEach((r) =>
          r.equipment_return_items.forEach((ri) => {
            returnsByProduct.set(
              ri.product_id,
              (returnsByProduct.get(ri.product_id) ?? 0) + ri.quantity
            );
          })
        );

        const totalReturned = p.equipment_pickup_items.reduce((sum, item) => {
          return sum + Math.min(item.quantity, returnsByProduct.get(item.product_id) ?? 0);
        }, 0);

        const pct = totalTaken > 0 ? Math.round((totalReturned / totalTaken) * 100) : 0;

        const items = p.equipment_pickup_items.map((item) => {
          const prod = productMap.get(item.product_id);
          return {
            product_id: item.product_id,
            product_name: prod?.name ?? item.product_id,
            sku: prod?.sku ?? null,
            quantity: item.quantity,
            returned: Math.min(item.quantity, returnsByProduct.get(item.product_id) ?? 0),
          };
        });

        return {
          id: p.id,
          pickup_date: p.pickup_date,
          installer_name: inst?.name ?? "—",
          division: inst?.division ?? "—",
          totalTaken,
          totalReturned,
          pct,
          items,
          notes: p.notes,
        };
      })
      .sort((a, b) => b.pickup_date.localeCompare(a.pickup_date));
  }, [pickups, returns, pickupsMonthDate, pickupsDivision, installerMap, productMap]);

  const togglePickupExpand = (id: string) => {
    setExpandedPickups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ─── Tab 3: Dashboard computations ────────────────────────────────────────

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
    () =>
      pickups.filter(
        (p) => dashInstallerIds.has(p.installer_id) && p.pickup_date >= dashStartDate
      ),
    [pickups, dashInstallerIds, dashStartDate]
  );

  const dashReturns = useMemo(
    () =>
      returns.filter(
        (r) => dashInstallerIds.has(r.installer_id) && r.return_date >= dashStartDate
      ),
    [returns, dashInstallerIds, dashStartDate]
  );

  const totalTaken = useMemo(
    () =>
      dashPickups.reduce(
        (sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0),
        0
      ),
    [dashPickups]
  );

  const totalReturned = useMemo(
    () =>
      dashReturns.reduce(
        (sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0),
        0
      ),
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

  const activeInstallerCount = useMemo(
    () => new Set(dashPickups.map((p) => p.installer_id)).size,
    [dashPickups]
  );

  const uniqueProductCount = useMemo(() => {
    const ids = new Set<string>();
    dashPickups.forEach((p) => p.equipment_pickup_items.forEach((i) => ids.add(i.product_id)));
    return ids.size;
  }, [dashPickups]);

  // Chart: consumption by product (top 10 taken)
  const chartConsumption = useMemo(() => {
    const map = new Map<string, number>();
    dashPickups.forEach((p) =>
      p.equipment_pickup_items.forEach((item) => {
        const name = productNameMap.get(item.product_id) ?? item.product_id;
        map.set(name, (map.get(name) ?? 0) + item.quantity);
      })
    );
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [dashPickups, productNameMap]);

  // Chart: return reasons (pie)
  const chartByReason = useMemo(() => {
    const map = new Map<string, number>();
    dashReturns.forEach((r) =>
      r.equipment_return_items.forEach((item) => {
        map.set(item.reason, (map.get(item.reason) ?? 0) + item.quantity);
      })
    );
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [dashReturns]);

  // Chart: return % by installer (horizontal bar)
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

  // Chart: monthly trend (consumption vs returns)
  const chartMonthlyTrend = useMemo(() => {
    const months = buildMonthOptions(6).reverse();
    return months.map(({ value, date }) => {
      const start = startOfMonth(date).toISOString().split("T")[0];
      const end = endOfMonth(date).toISOString().split("T")[0];
      const taken = pickups
        .filter(
          (p) =>
            dashInstallerIds.has(p.installer_id) &&
            p.pickup_date >= start &&
            p.pickup_date <= end
        )
        .reduce((sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0), 0);
      const ret = returns
        .filter(
          (r) =>
            dashInstallerIds.has(r.installer_id) &&
            r.return_date >= start &&
            r.return_date <= end
        )
        .reduce((sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0), 0);
      return { month: value, "צריכה": taken, "החזרות": ret };
    });
  }, [pickups, returns, dashInstallerIds]);

  // Waste items
  const wasteItems = useMemo((): ReturnItemFlat[] => {
    const rows: ReturnItemFlat[] = [];
    const instNameMap = new Map(installers.map((i) => [i.id, i.name]));
    dashReturns.forEach((r) => {
      r.equipment_return_items
        .filter((item) => item.is_actually_faulty === false)
        .forEach((item) => {
          rows.push({
            return_date: r.return_date,
            installer_id: r.installer_id,
            installer_name: instNameMap.get(r.installer_id) ?? r.installer_id,
            product_id: item.product_id,
            product_name: productNameMap.get(item.product_id) ?? item.product_id,
            quantity: item.quantity,
            reason: item.reason,
            is_actually_faulty: false,
          });
        });
    });
    return rows.sort((a, b) => b.return_date.localeCompare(a.return_date));
  }, [dashReturns, installers, productNameMap]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Boxes className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-bold">הצטיידות</h1>
      </div>

      <Tabs defaultValue="tracking">
        <TabsList className="mb-2 w-full justify-start">
          <TabsTrigger value="tracking">מעקב מתקינים</TabsTrigger>
          <TabsTrigger value="pickups">מעקב הצטיידויות</TabsTrigger>
          <TabsTrigger value="dashboard">לוח בקרה</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════
            TAB 1: מעקב מתקינים
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="tracking" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowNewInstaller(true)}>
                <UserPlus className="h-4 w-4 ms-1" />
                מתקין חדש
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewPickup(true)}>
                <Package className="h-4 w-4 ms-1" />
                הצטיידות חדשה
              </Button>
              <Button size="sm" onClick={() => setShowNewReturn(true)}>
                <PackageX className="h-4 w-4 ms-1" />
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
              <p className="text-sm text-muted-foreground/60">לחצו על "מתקין חדש" כדי להתחיל</p>
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
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDivisionPanel(inst.division);
                          }}
                        >
                          {inst.division}
                        </Badge>
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
                          className={`text-xs ${
                            inst.status === "פעיל"
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                          }`}
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
            TAB 2: מעקב הצטיידויות
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="pickups" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredPickupEvents.length} הצטיידויות
            </p>
            <div className="flex gap-2">
              <Select value={pickupsMonth} onValueChange={setPickupsMonth}>
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
              <Select value={pickupsDivision} onValueChange={setPickupsDivision}>
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

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : filteredPickupEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted/30 rounded-full mb-4">
                <Package className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <p className="text-base font-medium text-muted-foreground">אין הצטיידויות בתקופה זו</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead>מתקין</TableHead>
                    <TableHead className="text-center">חטיבה</TableHead>
                    <TableHead className="text-center">פריטים שנלקחו</TableHead>
                    <TableHead className="text-center">הוחזרו</TableHead>
                    <TableHead className="text-center">% החזרה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPickupEvents.map((pickup) => {
                    const isExpanded = expandedPickups.has(pickup.id);
                    return (
                      <>
                        <TableRow
                          key={pickup.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => togglePickupExpand(pickup.id)}
                        >
                          <TableCell className="text-center text-muted-foreground">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 mx-auto" />
                            ) : (
                              <ChevronDown className="h-4 w-4 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {format(new Date(pickup.pickup_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">{pickup.installer_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {pickup.division}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{pickup.totalTaken}</TableCell>
                          <TableCell className="text-center">{pickup.totalReturned}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold text-sm ${returnPctColor(pickup.pct)}`}>
                              {pickup.totalTaken > 0 ? `${pickup.pct}%` : "—"}
                            </span>
                          </TableCell>
                        </TableRow>

                        {/* Expanded items */}
                        {isExpanded && (
                          <TableRow key={`${pickup.id}-expanded`} className="bg-muted/10">
                            <TableCell></TableCell>
                            <TableCell colSpan={6} className="py-2 pb-3">
                              <div className="rounded border bg-background overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/30">
                                      <TableHead className="text-xs py-2">מוצר</TableHead>
                                      <TableHead className="text-xs py-2">מק"ט</TableHead>
                                      <TableHead className="text-center text-xs py-2">נלקח</TableHead>
                                      <TableHead className="text-center text-xs py-2">הוחזר</TableHead>
                                      <TableHead className="text-center text-xs py-2">יתרה</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {pickup.items.map((item, idx) => (
                                      <TableRow key={idx} className="text-sm">
                                        <TableCell className="py-1.5">{item.product_name}</TableCell>
                                        <TableCell className="py-1.5 text-xs text-muted-foreground font-mono">
                                          {item.sku ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-center py-1.5">
                                          {item.quantity}
                                        </TableCell>
                                        <TableCell className="text-center py-1.5">
                                          {item.returned}
                                        </TableCell>
                                        <TableCell className="text-center py-1.5">
                                          <span
                                            className={
                                              item.quantity - item.returned > 0
                                                ? "text-blue-600 font-medium"
                                                : "text-muted-foreground"
                                            }
                                          >
                                            {item.quantity - item.returned}
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              {pickup.notes && (
                                <p className="text-xs text-muted-foreground mt-1.5 px-1">
                                  הערה: {pickup.notes}
                                </p>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 3: לוח בקרה
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Filters */}
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

          {/* KPI cards — 5 cards */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                {
                  label: "פריטים שיצאו",
                  value: totalTaken,
                  icon: Package,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "מוצרים ייחודיים",
                  value: uniqueProductCount,
                  icon: ShoppingBag,
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                },
                {
                  label: "מתקינים פעילים",
                  value: activeInstallerCount,
                  icon: Users,
                  color: "text-teal-600",
                  bg: "bg-teal-50",
                },
                {
                  label: "אחוז החזרה",
                  value: `${overallPct}%`,
                  icon: TrendingDown,
                  color:
                    overallPct <= 5
                      ? "text-green-600"
                      : overallPct <= 15
                      ? "text-yellow-600"
                      : "text-red-600",
                  bg:
                    overallPct <= 5
                      ? "bg-green-50"
                      : overallPct <= 15
                      ? "bg-yellow-50"
                      : "bg-red-50",
                },
                {
                  label: "בזבוז (תקינים שהוחזרו)",
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
            <div className="space-y-6">
              {/* Row 1: Consumption + Return Reasons */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Consumption by product */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-1.5">
                      <ShoppingBag className="h-4 w-4 text-indigo-500" />
                      צריכה לפי מוצר — Top 10
                    </h3>
                    {chartConsumption.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        אין נתונים בתקופה זו
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.max(200, chartConsumption.length * 32)}>
                        <BarChart
                          data={chartConsumption}
                          layout="vertical"
                          margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            width={110}
                            orientation="right"
                          />
                          <Tooltip formatter={(v) => [v, "כמות"]} />
                          <Bar dataKey="value" fill="#6366f1" radius={[4, 0, 0, 4]} name="כמות" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Return reasons pie */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-1.5">
                      <PackageX className="h-4 w-4 text-orange-500" />
                      סיבות החזרה
                    </h3>
                    {chartByReason.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        אין נתונים בתקופה זו
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={chartByReason}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
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
              </div>

              {/* Row 2: Monthly trend */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4 text-blue-500" />
                    מגמה חודשית — צריכה מול החזרות
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={chartMonthlyTrend}
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="צריכה"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="החזרות"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Row 3: Return % by installer */}
              {chartByInstaller.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      אחוז החזרה לפי מתקין
                    </h3>
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(180, chartByInstaller.length * 34)}
                    >
                      <BarChart
                        data={chartByInstaller}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          width={65}
                          orientation="right"
                        />
                        <Tooltip formatter={(v) => [`${v}%`, "אחוז החזרה"]} />
                        <Bar dataKey="pct" radius={[4, 0, 0, 4]}>
                          {chartByInstaller.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Row 4: Waste table (collapsible) */}
              <WasteSection wasteItems={wasteItems} />
            </div>
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

      {/* Division panel */}
      <DivisionPanel
        division={divisionPanel}
        onClose={() => setDivisionPanel(null)}
        installers={installers}
        pickups={pickups}
        returns={returns}
      />
    </div>
  );
}

// ─── Waste section (collapsible) ──────────────────────────────────────────────

function WasteSection({ wasteItems }: { wasteItems: ReturnItemFlat[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setOpen((v) => !v)}
        >
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            פריטים שהוחזרו ונמצאו תקינים — הבזבוז
            {wasteItems.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {wasteItems.length}
              </Badge>
            )}
          </h3>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {open && (
          <div className="mt-3">
            {wasteItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
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
                          <Badge variant="secondary" className="text-xs">
                            {item.reason}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
