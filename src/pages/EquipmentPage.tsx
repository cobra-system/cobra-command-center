import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Layers,
  Package,
  PackageX,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Building2,
  AlertTriangle,
  ShoppingBag,
  TrendingDown,
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
  entity_type: string; // 'technician' | 'bonded'
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_DIVISIONS = ["הכל", "AWACS", "כפתור", "DOORE", "דלק מוטורס", "פריזבי קרסו", "לובינסקי"];

function monthLabel(d: Date) {
  return format(d, "MM/yyyy");
}
function buildMonthOptions(n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: monthLabel(d), date: startOfMonth(d) };
  });
}

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const navigate = useNavigate();
  const { products } = useData();

  // ── Shared data ──
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [pickups, setPickups] = useState<PickupWithItems[]>([]);
  const [returns, setReturns] = useState<ReturnWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const monthOptions = useMemo(() => buildMonthOptions(12), []);

  // ── Tab 1: מקבלי ציוד ──
  const [trackMonth, setTrackMonth] = useState(monthOptions[0].value);
  const [trackDivision, setTrackDivision] = useState("הכל");

  // ── Tab 2: מעקב הצטיידויות ──
  const [pickupsMonth, setPickupsMonth] = useState(monthOptions[0].value);
  const [pickupsDivision, setPickupsDivision] = useState("הכל");
  const [expandedPickups, setExpandedPickups] = useState<Set<string>>(new Set());

  // ── Tab 4: לוח בקרה ──
  const [dashPeriod, setDashPeriod] = useState("3");
  const [dashDivision, setDashDivision] = useState("הכל");

  // ── Division panel ──
  const [divisionPanel, setDivisionPanel] = useState<string | null>(null);

  // ── Dialogs ──
  const [showNewInstaller, setShowNewInstaller] = useState(false);
  const [showNewPickup, setShowNewPickup] = useState(false);
  const [showNewReturn, setShowNewReturn] = useState(false);

  // ── Product maps ──
  const productMap = useMemo(() => {
    const m = new Map<string, { name: string; sku: string | null }>();
    products.forEach((p) => m.set(p.id, { name: p.name, sku: p.sku ?? null }));
    return m;
  }, [products]);

  const productNameMap = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products]
  );

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, pickRes, retRes] = await Promise.all([
        supabase.from("installers").select("*").order("name"),
        supabase
          .from("equipment_pickups")
          .select("id, installer_id, pickup_date, notes, equipment_pickup_items(quantity, product_id)")
          .order("pickup_date", { ascending: false }),
        supabase
          .from("equipment_returns")
          .select("id, installer_id, return_date, equipment_return_items(quantity, reason, is_actually_faulty, product_id)")
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Tab 1: Recipient stats ───────────────────────────────────────────────

  const trackMonthDate = useMemo(
    () => monthOptions.find((m) => m.value === trackMonth)?.date ?? new Date(),
    [trackMonth, monthOptions]
  );

  const filteredInstallers = useMemo(() => {
    if (trackDivision === "הכל") return installers;
    return installers.filter((i) => i.division === trackDivision);
  }, [installers, trackDivision]);

  const recipientStats = useMemo(() => {
    const start = startOfMonth(trackMonthDate).toISOString().split("T")[0];
    const end = endOfMonth(trackMonthDate).toISOString().split("T")[0];
    return filteredInstallers.map((inst) => {
      const instPickups = pickups.filter(
        (p) => p.installer_id === inst.id && p.pickup_date >= start && p.pickup_date <= end
      );
      const instReturns = returns.filter(
        (r) => r.installer_id === inst.id && r.return_date >= start && r.return_date <= end
      );
      const taken = instPickups.reduce(
        (s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0), 0
      );
      const returned = instReturns.reduce(
        (s, r) => s + r.equipment_return_items.reduce((ss, i) => ss + i.quantity, 0), 0
      );
      const pct = taken > 0 ? Math.round((returned / taken) * 100) : 0;
      const lastPickup = instPickups.length > 0
        ? instPickups.reduce((a, b) => (a.pickup_date > b.pickup_date ? a : b)).pickup_date
        : null;
      return { ...inst, pickupCount: instPickups.length, taken, returned, pct, lastPickup };
    }).sort((a, b) => b.pct - a.pct);
  }, [filteredInstallers, pickups, returns, trackMonthDate]);

  // ─── Tab 2: Pickup tracking ───────────────────────────────────────────────

  const installerMap = useMemo(() => new Map(installers.map((i) => [i.id, i])), [installers]);

  const pickupsMonthDate = useMemo(
    () => monthOptions.find((m) => m.value === pickupsMonth)?.date ?? new Date(),
    [pickupsMonth, monthOptions]
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
        const returnsByProduct = new Map<string, number>();
        returns
          .filter((r) => r.installer_id === p.installer_id && r.return_date >= p.pickup_date)
          .forEach((r) => r.equipment_return_items.forEach((ri) => {
            returnsByProduct.set(ri.product_id, (returnsByProduct.get(ri.product_id) ?? 0) + ri.quantity);
          }));
        const totalReturned = p.equipment_pickup_items.reduce(
          (s, i) => s + Math.min(i.quantity, returnsByProduct.get(i.product_id) ?? 0), 0
        );
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
          id: p.id, pickup_date: p.pickup_date,
          installer_name: inst?.name ?? "—",
          division: inst?.division ?? "—",
          entity_type: inst?.entity_type ?? "technician",
          totalTaken, totalReturned, pct, items, notes: p.notes,
        };
      })
      .sort((a, b) => b.pickup_date.localeCompare(a.pickup_date));
  }, [pickups, returns, pickupsMonthDate, pickupsDivision, installerMap, productMap]);

  const togglePickupExpand = (id: string) => {
    setExpandedPickups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // ─── Tab 3: Field inventory (מלאי שטח) ───────────────────────────────────

  const fieldInventory = useMemo(() => {
    // Per (installer, product): taken - returned
    const map = new Map<string, { installer: Installer; product_id: string; balance: number }>();
    pickups.forEach((p) => {
      p.equipment_pickup_items.forEach((item) => {
        const key = `${p.installer_id}::${item.product_id}`;
        const existing = map.get(key);
        if (existing) {
          existing.balance += item.quantity;
        } else {
          const inst = installerMap.get(p.installer_id);
          if (inst) map.set(key, { installer: inst, product_id: item.product_id, balance: item.quantity });
        }
      });
    });
    returns.forEach((r) => {
      r.equipment_return_items.forEach((item) => {
        const key = `${r.installer_id}::${item.product_id}`;
        const existing = map.get(key);
        if (existing) existing.balance = Math.max(0, existing.balance - item.quantity);
      });
    });
    return Array.from(map.values())
      .filter((e) => e.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [pickups, returns, installerMap]);

  const fieldTotalItems = useMemo(
    () => fieldInventory.reduce((s, e) => s + e.balance, 0),
    [fieldInventory]
  );
  const fieldActiveRecipients = useMemo(
    () => new Set(fieldInventory.map((e) => e.installer.id)).size,
    [fieldInventory]
  );

  // ─── Tab 4: Dashboard ─────────────────────────────────────────────────────

  const dashStart = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(dashPeriod));
    return startOfDay(d).toISOString().split("T")[0];
  }, [dashPeriod]);

  const dashInstallers = useMemo(() => {
    if (dashDivision === "הכל") return installers;
    return installers.filter((i) => i.division === dashDivision);
  }, [installers, dashDivision]);

  const dashInstallerIds = useMemo(
    () => new Set(dashInstallers.map((i) => i.id)),
    [dashInstallers]
  );

  const dashPickups = useMemo(
    () => pickups.filter((p) => dashInstallerIds.has(p.installer_id) && p.pickup_date >= dashStart),
    [pickups, dashInstallerIds, dashStart]
  );
  const dashReturns = useMemo(
    () => returns.filter((r) => dashInstallerIds.has(r.installer_id) && r.return_date >= dashStart),
    [returns, dashInstallerIds, dashStart]
  );

  const kpiTaken = useMemo(
    () => dashPickups.reduce((s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0), 0),
    [dashPickups]
  );
  const kpiReturned = useMemo(
    () => dashReturns.reduce((s, r) => s + r.equipment_return_items.reduce((ss, i) => ss + i.quantity, 0), 0),
    [dashReturns]
  );
  const kpiInField = kpiTaken - kpiReturned;
  const kpiWaste = useMemo(
    () => dashReturns.reduce(
      (s, r) => s + r.equipment_return_items.filter((i) => i.is_actually_faulty === false).reduce((ss, i) => ss + i.quantity, 0), 0
    ),
    [dashReturns]
  );

  // Per-entity summary table
  const entitySummary = useMemo(() => {
    return dashInstallers.map((inst) => {
      const taken = dashPickups.filter((p) => p.installer_id === inst.id)
        .reduce((s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0), 0);
      const returned = dashReturns.filter((r) => r.installer_id === inst.id)
        .reduce((s, r) => s + r.equipment_return_items.reduce((ss, i) => ss + i.quantity, 0), 0);
      const inField = taken - returned;
      const pct = taken > 0 ? Math.round((returned / taken) * 100) : 0;
      const lastPickup = dashPickups
        .filter((p) => p.installer_id === inst.id)
        .reduce((latest: string | null, p) =>
          latest === null || p.pickup_date > latest ? p.pickup_date : latest, null);
      return { ...inst, taken, returned, inField, pct, lastPickup };
    }).filter((e) => e.taken > 0).sort((a, b) => b.taken - a.taken);
  }, [dashInstallers, dashPickups, dashReturns]);

  // Top-10 consumed products
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

  // Monthly trend (items out per month)
  const chartMonthly = useMemo(() => {
    const months = buildMonthOptions(6).reverse();
    return months.map(({ value, date }) => {
      const start = startOfMonth(date).toISOString().split("T")[0];
      const end = endOfMonth(date).toISOString().split("T")[0];
      const taken = pickups
        .filter((p) => dashInstallerIds.has(p.installer_id) && p.pickup_date >= start && p.pickup_date <= end)
        .reduce((s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0), 0);
      const returned = returns
        .filter((r) => dashInstallerIds.has(r.installer_id) && r.return_date >= start && r.return_date <= end)
        .reduce((s, r) => s + r.equipment_return_items.reduce((ss, i) => ss + i.quantity, 0), 0);
      return { month: value, "יצא": taken, "חזר": returned };
    });
  }, [pickups, returns, dashInstallerIds]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-bold">חטיבות</h1>
      </div>

      <Tabs defaultValue="recipients">
        <TabsList className="mb-2 w-full justify-start">
          <TabsTrigger value="recipients">חטיבות</TabsTrigger>
          <TabsTrigger value="pickups">מעקב הצטיידויות</TabsTrigger>
          <TabsTrigger value="field">מלאי שטח</TabsTrigger>
          <TabsTrigger value="dashboard">לוח בקרה</TabsTrigger>
        </TabsList>

        {/* ══ TAB 1: מקבלי ציוד ══════════════════════════════════════════════ */}
        <TabsContent value="recipients" className="space-y-4">
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
              <Select value={trackMonth} onValueChange={setTrackMonth}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={trackDivision} onValueChange={setTrackDivision}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_DIVISIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
            </div>
          ) : recipientStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted/30 rounded-full mb-4">
                <Layers className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <p className="text-base font-medium text-muted-foreground">אין מקבלי ציוד</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead className="text-center">סוג</TableHead>
                    <TableHead className="text-center">חטיבה</TableHead>
                    <TableHead className="text-center">הצטיידויות</TableHead>
                    <TableHead className="text-center">נלקחו</TableHead>
                    <TableHead className="text-center">הוחזרו</TableHead>
                    <TableHead className="text-center">% החזרה</TableHead>
                    <TableHead className="text-center hidden md:table-cell">עדכון אחרון</TableHead>
                    <TableHead className="text-center">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipientStats.map((inst) => (
                    <TableRow
                      key={inst.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => inst.entity_type === "technician" && navigate(`/equipment/installer/${inst.id}`)}
                    >
                      <TableCell className="font-medium">{inst.name}</TableCell>
                      <TableCell className="text-center">
                        {inst.entity_type === "bonded" ? (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                            <Building2 className="h-3 w-3 ms-1" />
                            גוף
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            טכנאי
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted transition-colors"
                          onClick={(e) => { e.stopPropagation(); setDivisionPanel(inst.division); }}
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
                        {inst.lastPickup ? format(new Date(inst.lastPickup), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-xs ${inst.status === "פעיל" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}`}>
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

        {/* ══ TAB 2: מעקב הצטיידויות ════════════════════════════════════════ */}
        <TabsContent value="pickups" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <p className="text-sm text-muted-foreground">{filteredPickupEvents.length} הצטיידויות</p>
            <div className="flex gap-2">
              <Select value={pickupsMonth} onValueChange={setPickupsMonth}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={pickupsDivision} onValueChange={setPickupsDivision}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_DIVISIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
            </div>
          ) : filteredPickupEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-base font-medium text-muted-foreground">אין הצטיידויות בתקופה זו</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead>מקבל</TableHead>
                    <TableHead className="text-center">חטיבה</TableHead>
                    <TableHead className="text-center">נלקחו</TableHead>
                    <TableHead className="text-center">הוחזרו</TableHead>
                    <TableHead className="text-center">% החזרה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPickupEvents.map((pickup) => {
                    const isExpanded = expandedPickups.has(pickup.id);
                    return (
                      <React.Fragment key={pickup.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => togglePickupExpand(pickup.id)}
                        >
                          <TableCell className="text-center text-muted-foreground">
                            {isExpanded ? <ChevronUp className="h-4 w-4 mx-auto" /> : <ChevronDown className="h-4 w-4 mx-auto" />}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {format(new Date(pickup.pickup_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">{pickup.installer_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">{pickup.division}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{pickup.totalTaken}</TableCell>
                          <TableCell className="text-center">{pickup.totalReturned}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold text-sm ${returnPctColor(pickup.pct)}`}>
                              {pickup.totalTaken > 0 ? `${pickup.pct}%` : "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/10">
                            <TableCell />
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
                                        <TableCell className="py-1.5 text-xs text-muted-foreground font-mono">{item.sku ?? "—"}</TableCell>
                                        <TableCell className="text-center py-1.5">{item.quantity}</TableCell>
                                        <TableCell className="text-center py-1.5">{item.returned}</TableCell>
                                        <TableCell className="text-center py-1.5">
                                          <span className={item.quantity - item.returned > 0 ? "text-blue-600 font-medium" : "text-muted-foreground"}>
                                            {item.quantity - item.returned}
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              {pickup.notes && (
                                <p className="text-xs text-muted-foreground mt-1.5 px-1">הערה: {pickup.notes}</p>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ══ TAB 3: מלאי שטח ════════════════════════════════════════════════ */}
        <TabsContent value="field" className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "פריטים בשטח", value: fieldTotalItems, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "מקבלים עם ציוד פתוח", value: fieldActiveRecipients, icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50" },
                  { label: "מוצרים שונים בשטח", value: new Set(fieldInventory.map((e) => e.product_id)).size, icon: ShoppingBag, color: "text-teal-600", bg: "bg-teal-50" },
                ].map((kpi) => (
                  <Card key={kpi.label}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${kpi.bg}`}>
                        <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                        <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {fieldInventory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md">
                  <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">אין ציוד פתוח בשטח</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>מקבל</TableHead>
                        <TableHead className="text-center">סוג</TableHead>
                        <TableHead className="text-center">חטיבה</TableHead>
                        <TableHead>מוצר</TableHead>
                        <TableHead className="text-xs text-muted-foreground">מק"ט</TableHead>
                        <TableHead className="text-center">בשטח</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fieldInventory.map((entry, idx) => {
                        const prod = productMap.get(entry.product_id);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{entry.installer.name}</TableCell>
                            <TableCell className="text-center">
                              {entry.installer.entity_type === "bonded" ? (
                                <Building2 className="h-3.5 w-3.5 text-purple-500 mx-auto" />
                              ) : (
                                <span className="text-xs text-blue-600">טכנאי</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">{entry.installer.division}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{prod?.name ?? entry.product_id}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">{prod?.sku ?? "—"}</TableCell>
                            <TableCell className="text-center font-bold text-blue-600">{entry.balance}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ══ TAB 4: לוח בקרה ════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-5">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">תקופה:</span>
            <Select value={dashPeriod} onValueChange={setDashPeriod}>
              <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">30 יום</SelectItem>
                <SelectItem value="3">3 חודשים</SelectItem>
                <SelectItem value="6">6 חודשים</SelectItem>
                <SelectItem value="12">שנה</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dashDivision} onValueChange={setDashDivision}>
              <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_DIVISIONS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* KPI row — 4 clean cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "יצא לשטח", value: kpiTaken, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "בשטח עכשיו", value: kpiInField, icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50" },
                  { label: "הוחזר", value: kpiReturned, icon: PackageX, color: "text-orange-600", bg: "bg-orange-50" },
                  { label: "בזבוז (תקין → הוחזר)", value: kpiWaste, icon: AlertTriangle, color: kpiWaste > 0 ? "text-red-600" : "text-green-600", bg: kpiWaste > 0 ? "bg-red-50" : "bg-green-50" },
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

              {/* Per-entity table */}
              {entitySummary.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3">סיכום לפי גוף / מתקין</h3>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>שם</TableHead>
                            <TableHead className="text-center">יצא</TableHead>
                            <TableHead className="text-center">בשטח</TableHead>
                            <TableHead className="text-center">הוחזר</TableHead>
                            <TableHead className="text-center">% החזרה</TableHead>
                            <TableHead className="hidden md:table-cell text-center">הצטיידות אחרונה</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entitySummary.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium text-sm py-2">
                                <div className="flex items-center gap-1.5">
                                  {e.entity_type === "bonded" && <Building2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                                  {e.name}
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-2">{e.taken}</TableCell>
                              <TableCell className="text-center py-2 font-medium text-blue-600">{e.inField}</TableCell>
                              <TableCell className="text-center py-2">{e.returned}</TableCell>
                              <TableCell className="text-center py-2">
                                <span className={`font-bold text-sm ${returnPctColor(e.pct)}`}>
                                  {e.taken > 0 ? `${e.pct}%` : "—"}
                                </span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-center py-2 text-sm text-muted-foreground">
                                {e.lastPickup ? format(new Date(e.lastPickup), "dd/MM/yyyy") : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top consumption chart */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-indigo-500" />
                    צריכה — Top 10 מוצרים
                  </h3>
                  {chartConsumption.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">אין נתונים בתקופה זו</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(180, chartConsumption.length * 30)}>
                      <BarChart
                        data={chartConsumption}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} orientation="right" />
                        <Tooltip formatter={(v) => [v, "כמות"]} />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 0, 0, 4]} name="כמות" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Monthly trend */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4 text-blue-500" />
                    מגמה חודשית — יצא מול חזר
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartMonthly} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="יצא" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="חזר" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NewInstallerDialog open={showNewInstaller} onOpenChange={setShowNewInstaller} onCreated={fetchData} />
      <NewPickupDialog open={showNewPickup} onOpenChange={setShowNewPickup} onCreated={fetchData} />
      <NewReturnDialog open={showNewReturn} onOpenChange={setShowNewReturn} onCreated={fetchData} />

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
