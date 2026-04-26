import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronLeft,
  Package,
  PackageX,
  TrendingDown,
  Users,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Warehouse,
  AlertTriangle,
  ArrowLeftRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DIVISIONS, DIVISION_COLORS, BONDED_DIVISIONS, SALES_DIVISIONS } from "@/components/equipment/constants";
import type { ColDef } from "@/hooks/useColumnVisibility";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import {
  ColContextMenu,
  useColMenu,
  colThContextMenu,
  trContextMenu,
} from "@/components/ui/ColContextMenu";
import { NewInstallerDialog } from "@/components/equipment/NewInstallerDialog";
import { NewPickupDialog } from "@/components/equipment/NewPickupDialog";
import { NewReturnDialog } from "@/components/equipment/NewReturnDialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Installer {
  id: string;
  name: string;
  warehouse_number: number | null;
  division: string;
  status: string;
  coordinator: string | null;
  phone: string | null;
}

interface PickupItemRaw {
  id: string;
  product_id: string;
  quantity: number;
  serial_numbers: string[] | null;
}

interface PickupRaw {
  id: string;
  installer_id: string;
  pickup_date: string;
  notes: string | null;
  created_by: string | null;
  equipment_pickup_items: PickupItemRaw[];
}

interface ReturnItemRaw {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  reason_detail: string | null;
  sticker_label: string | null;
  is_actually_faulty: boolean | null;
  serial_numbers: string[] | null;
}

interface ReturnRaw {
  id: string;
  installer_id: string;
  return_date: string;
  logged_by: string | null;
  equipment_return_items: ReturnItemRaw[];
}

interface DistributionCenter {
  id: string;
  name: string;
  type: string;
  city: string | null;
  address: string | null;
  is_main: boolean;
  division: string | null;
}

interface CenterInventoryItem {
  id: string;
  center_id: string;
  product_id: string;
  quantity: number;
  min_stock: number;
}

interface InventoryTransfer {
  id: string;
  from_center_id: string | null;
  to_center_id: string | null;
  product_id: string | null;
  quantity: number;
  notes: string | null;
  transferred_by: string | null;
  created_at: string;
}

// ─── Column Defs ─────────────────────────────────────────────────────────────

const PICKUP_COLS: ColDef[] = [
  { id: "date", label: "תאריך", sortField: "date" },
  { id: "recipient", label: "מקבל", sortField: "recipient" },
  { id: "taken", label: "נלקחו", sortField: "taken" },
  { id: "notes", label: "הערות" },
];

const INVENTORY_COLS: ColDef[] = [
  { id: "installer", label: "טכנאי", sortField: "installer" },
  { id: "product", label: "מוצר", sortField: "product" },
  { id: "sku", label: 'מק"ט' },
  { id: "balance", label: "בשטח", sortField: "balance" },
];

const DASHBOARD_COLS: ColDef[] = [
  { id: "division",  label: "חטיבה",          sortField: "division"  },
  { id: "active",    label: "טכנאים פעילים",  sortField: "active"    },
  { id: "taken",     label: "יצאו",            sortField: "taken"     },
  { id: "returned",  label: "הוחזרו",          sortField: "returned"  },
  { id: "inField",   label: "בשטח",            sortField: "inField"   },
  { id: "pct",       label: "% החזרה",         sortField: "pct"       },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function returnPctColor(pct: number) {
  if (pct <= 5) return "text-green-600";
  if (pct <= 15) return "text-yellow-600";
  return "text-red-600";
}

function buildMonthOptions(pickups: PickupRaw[], returns: ReturnRaw[]) {
  const months = new Set<string>();
  pickups.forEach((p) => months.add(p.pickup_date.slice(0, 7)));
  returns.forEach((r) => months.add(r.return_date.slice(0, 7)));
  return [...months]
    .sort()
    .reverse()
    .map((m) => ({
      value: m,
      label: format(new Date(m + "-01"), "MMMM yyyy"),
    }));
}

function SortIcon({
  field,
  currentField,
  currentDir,
}: {
  field: string;
  currentField: string | null;
  currentDir: "asc" | "desc";
}) {
  if (currentField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { products } = useData();
  const { currentUser } = useAuth();

  // Division managers bypass the overview and go directly to their division
  useEffect(() => {
    if (currentUser?.division) {
      navigate(`/equipment/division/${encodeURIComponent(currentUser.division)}`, { replace: true });
    }
  }, [currentUser, navigate]);

  const [installers, setInstallers] = useState<Installer[]>([]);
  const [pickups, setPickups] = useState<PickupRaw[]>([]);
  const [returns, setReturns] = useState<ReturnRaw[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "divisions");

  // Center inventory state (warehouses tab)
  const [centers, setCenters] = useState<DistributionCenter[]>([]);
  const [centerInventory, setCenterInventory] = useState<CenterInventoryItem[]>([]);
  const [centerTransfers, setCenterTransfers] = useState<InventoryTransfer[]>([]);
  const [centersLoading, setCentersLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [expandedPickupId, setExpandedPickupId] = useState<string | null>(null);
  // Day-hierarchy expansion state (Tab 2)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedDivInDay, setExpandedDivInDay] = useState<Set<string>>(new Set());

  const [showNewInstaller, setShowNewInstaller] = useState(false);
  const [showNewPickup, setShowNewPickup] = useState(false);
  const [showNewReturn, setShowNewReturn] = useState(false);

  const [pickupSortField, setPickupSortField] = useState<string | null>("date");
  const [pickupSortDir, setPickupSortDir] = useState<"asc" | "desc">("desc");
  const [invSortField, setInvSortField] = useState<string | null>("installer");
  const [invSortDir, setInvSortDir] = useState<"asc" | "desc">("asc");
  const [dashSortField, setDashSortField] = useState<string | null>(null);
  const [dashSortDir, setDashSortDir] = useState<"asc" | "desc">("asc");

  const pickupColVis = useColumnVisibility("equipment-pickups:hidden-columns", PICKUP_COLS);
  const invColVis = useColumnVisibility("equipment-inventory:hidden-columns", INVENTORY_COLS);
  const dashColVis = useColumnVisibility("equipment-dashboard:hidden-columns", DASHBOARD_COLS);
  const { menu: pickupMenu, setMenu: setPickupMenu, closeMenu: closePickupMenu } = useColMenu();
  const { menu: invMenu, setMenu: setInvMenu, closeMenu: closeInvMenu } = useColMenu();
  const { menu: dashMenu, setMenu: setDashMenu, closeMenu: closeDashMenu } = useColMenu();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const installerMap = useMemo(() => new Map(installers.map((i) => [i.id, i])), [installers]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, pickRes, retRes] = await Promise.all([
        supabase
          .from("installers")
          .select("id, name, warehouse_number, division, status, coordinator, phone")
          .order("name"),
        supabase
          .from("equipment_pickups")
          .select(
            "id, installer_id, pickup_date, notes, created_by, equipment_pickup_items(id, product_id, quantity, serial_numbers)"
          )
          .order("pickup_date", { ascending: false }),
        supabase
          .from("equipment_returns")
          .select(
            "id, installer_id, return_date, logged_by, equipment_return_items(id, product_id, quantity, reason, reason_detail, sticker_label, is_actually_faulty, serial_numbers)"
          )
          .order("return_date", { ascending: false }),
      ]);
      if (instRes.error) throw instRes.error;
      if (pickRes.error) throw pickRes.error;
      if (retRes.error) throw retRes.error;
      setInstallers((instRes.data ?? []) as Installer[]);
      setPickups((pickRes.data ?? []) as PickupRaw[]);
      setReturns((retRes.data ?? []) as ReturnRaw[]);
    } catch {
      toast.error("שגיאה בטעינת נתוני הצטיידות");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab !== "warehouses") return;
    async function fetchCenters() {
      setCentersLoading(true);
      const [{ data: c }, { data: inv }, { data: tr }] = await Promise.all([
        supabase.from("distribution_centers").select("*").order("is_main", { ascending: false }).order("name"),
        supabase.from("center_inventory").select("*"),
        supabase.from("inventory_transfers").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      setCenters((c ?? []) as DistributionCenter[]);
      setCenterInventory((inv ?? []) as CenterInventoryItem[]);
      setCenterTransfers((tr ?? []) as InventoryTransfer[]);
      setCentersLoading(false);
    }
    fetchCenters();
  }, [activeTab]);

  const monthOptions = useMemo(() => buildMonthOptions(pickups, returns), [pickups, returns]);

  // ── Division stats (all-time) for Tab 1 cards ──
  const divisionStats = useMemo(() => {
    return DIVISIONS.map((div) => {
      const divInstallers = installers.filter((i) => i.division === div);
      const installerIds = new Set(divInstallers.map((i) => i.id));
      const activeCount = divInstallers.filter((i) => i.status === "פעיל").length;
      const totalTaken = pickups
        .filter((p) => installerIds.has(p.installer_id))
        .reduce((sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0), 0);
      const totalReturned = returns
        .filter((r) => installerIds.has(r.installer_id))
        .reduce((sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0), 0);
      const inField = totalTaken - totalReturned;
      const returnPct = totalTaken > 0 ? Math.round((totalReturned / totalTaken) * 100) : 0;
      return { division: div, activeCount, totalTaken, totalReturned, inField, returnPct };
    });
  }, [installers, pickups, returns]);

  // ── Filtered + sorted pickups (Tab 2) ──
  const filteredPickups = useMemo(() => {
    return pickups.filter((p) => {
      const installer = installerMap.get(p.installer_id);
      if (selectedDivision !== "all" && installer?.division !== selectedDivision) return false;
      if (selectedMonth !== "all" && !p.pickup_date.startsWith(selectedMonth)) return false;
      return true;
    });
  }, [pickups, installerMap, selectedDivision, selectedMonth]);

  const sortedPickups = useMemo(() => {
    return [...filteredPickups].sort((a, b) => {
      if (pickupSortField === "date") {
        return pickupSortDir === "asc"
          ? a.pickup_date.localeCompare(b.pickup_date)
          : b.pickup_date.localeCompare(a.pickup_date);
      }
      if (pickupSortField === "recipient") {
        const aName = installerMap.get(a.installer_id)?.name ?? "";
        const bName = installerMap.get(b.installer_id)?.name ?? "";
        return pickupSortDir === "asc"
          ? aName.localeCompare(bName, "he")
          : bName.localeCompare(aName, "he");
      }
      if (pickupSortField === "taken") {
        const aTaken = a.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0);
        const bTaken = b.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0);
        return pickupSortDir === "asc" ? aTaken - bTaken : bTaken - aTaken;
      }
      return 0;
    });
  }, [filteredPickups, pickupSortField, pickupSortDir, installerMap]);

  // ── Dashboard sorted stats ──
  const sortedDivisionStats = useMemo(() => {
    return [...divisionStats].sort((a, b) => {
      if (!dashSortField) return 0;
      const dir = dashSortDir === "asc" ? 1 : -1;
      if (dashSortField === "division") return a.division.localeCompare(b.division, "he") * dir;
      if (dashSortField === "active") return (a.activeCount - b.activeCount) * dir;
      if (dashSortField === "taken") return (a.totalTaken - b.totalTaken) * dir;
      if (dashSortField === "returned") return (a.totalReturned - b.totalReturned) * dir;
      if (dashSortField === "inField") return (a.inField - b.inField) * dir;
      if (dashSortField === "pct") return (a.returnPct - b.returnPct) * dir;
      return 0;
    });
  }, [divisionStats, dashSortField, dashSortDir]);

  // ── Tab 2: group by day → division ──
  const pickupsByDay = useMemo(() => {
    const dayMap = new Map<string, PickupRaw[]>();
    sortedPickups.forEach((p) => {
      if (!dayMap.has(p.pickup_date)) dayMap.set(p.pickup_date, []);
      dayMap.get(p.pickup_date)!.push(p);
    });
    return [...dayMap.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [sortedPickups]);

  // ── Field inventory (all-time balance > 0) ──
  const fieldInventory = useMemo(() => {
    const map = new Map<
      string,
      { installerId: string; productId: string; taken: number; returned: number }
    >();
    pickups.forEach((p) => {
      p.equipment_pickup_items.forEach((item) => {
        const key = `${p.installer_id}:${item.product_id}`;
        if (!map.has(key))
          map.set(key, {
            installerId: p.installer_id,
            productId: item.product_id,
            taken: 0,
            returned: 0,
          });
        map.get(key)!.taken += item.quantity;
      });
    });
    returns.forEach((r) => {
      r.equipment_return_items.forEach((item) => {
        const key = `${r.installer_id}:${item.product_id}`;
        if (!map.has(key))
          map.set(key, {
            installerId: r.installer_id,
            productId: item.product_id,
            taken: 0,
            returned: 0,
          });
        map.get(key)!.returned += item.quantity;
      });
    });
    return [...map.values()]
      .map((entry) => ({
        ...entry,
        installerName: installerMap.get(entry.installerId)?.name ?? entry.installerId,
        division: installerMap.get(entry.installerId)?.division ?? "אחר",
        productName: productMap.get(entry.productId)?.name ?? entry.productId,
        sku: productMap.get(entry.productId)?.sku ?? null,
        balance: entry.taken - entry.returned,
      }))
      .filter((e) => e.balance > 0);
  }, [pickups, returns, installerMap, productMap]);

  const filteredInventory = useMemo(() => {
    let items = fieldInventory;
    if (selectedDivision !== "all") items = items.filter((i) => i.division === selectedDivision);
    return [...items].sort((a, b) => {
      if (invSortField === "product")
        return invSortDir === "asc"
          ? a.productName.localeCompare(b.productName, "he")
          : b.productName.localeCompare(a.productName, "he");
      if (invSortField === "balance")
        return invSortDir === "asc" ? a.balance - b.balance : b.balance - a.balance;
      return invSortDir === "asc"
        ? a.installerName.localeCompare(b.installerName, "he")
        : b.installerName.localeCompare(a.installerName, "he");
    });
  }, [fieldInventory, selectedDivision, invSortField, invSortDir]);

  const inventoryByDivision = useMemo(() => {
    const map = new Map<string, typeof filteredInventory>();
    filteredInventory.forEach((item) => {
      if (!map.has(item.division)) map.set(item.division, []);
      map.get(item.division)!.push(item);
    });
    return map;
  }, [filteredInventory]);

  // ── Dashboard KPIs ──
  const totalTakenAll = useMemo(
    () =>
      pickups.reduce(
        (s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0),
        0
      ),
    [pickups]
  );
  const totalReturnedAll = useMemo(
    () =>
      returns.reduce(
        (s, r) => s + r.equipment_return_items.reduce((ss, i) => ss + i.quantity, 0),
        0
      ),
    [returns]
  );

  const topProductsData = useMemo(() => {
    const map = new Map<string, number>();
    pickups.forEach((p) => {
      p.equipment_pickup_items.forEach((item) => {
        const name = productMap.get(item.product_id)?.name ?? item.product_id;
        map.set(name, (map.get(name) ?? 0) + item.quantity);
      });
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, qty]) => ({
        name: name.length > 20 ? name.slice(0, 17) + "..." : name,
        qty,
      }));
  }, [pickups, productMap]);

  const monthlyTrendData = useMemo(() => {
    const months = new Set<string>();
    pickups.forEach((p) => months.add(p.pickup_date.slice(0, 7)));
    returns.forEach((r) => months.add(r.return_date.slice(0, 7)));
    return [...months]
      .sort()
      .slice(-12)
      .map((m) => {
        const taken = pickups
          .filter((p) => p.pickup_date.startsWith(m))
          .reduce((s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0), 0);
        const returned = returns
          .filter((r) => r.return_date.startsWith(m))
          .reduce(
            (s, r) => s + r.equipment_return_items.reduce((ss, i) => ss + i.quantity, 0),
            0
          );
        return { month: format(new Date(m + "-01"), "MM/yy"), taken, returned };
      });
  }, [pickups, returns]);

  function togglePickupSort(field: string) {
    if (pickupSortField === field) {
      setPickupSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setPickupSortField(field);
      setPickupSortDir("desc");
    }
  }

  function toggleInvSort(field: string) {
    if (invSortField === field) {
      setInvSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setInvSortField(field);
      setInvSortDir("asc");
    }
  }

  function toggleDashSort(field: string) {
    if (dashSortField === field) {
      setDashSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setDashSortField(field);
      setDashSortDir("asc");
    }
  }

  function toggleDay(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) { next.delete(date); } else { next.add(date); }
      return next;
    });
  }

  function toggleDivInDay(key: string) {
    setExpandedDivInDay((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">ניהול חטיבות</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowNewInstaller(true)}>
            <Plus className="h-4 w-4 me-1" />
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList>
          <TabsTrigger value="divisions">חטיבות</TabsTrigger>
          <TabsTrigger value="pickups">מעקב הצטיידויות</TabsTrigger>
          <TabsTrigger value="inventory">מלאי שטח</TabsTrigger>
          <TabsTrigger value="dashboard">לוח בקרה</TabsTrigger>
          <TabsTrigger value="warehouses">מחסנים</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Division Cards ── */}
        <TabsContent value="divisions" className="mt-4 space-y-6">
          {/* Sales divisions */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              חטיבות מכירות
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {divisionStats.filter((s) => SALES_DIVISIONS.has(s.division)).map((stat) => {
                const colorClass =
                  DIVISION_COLORS[stat.division] ?? "bg-gray-100 text-gray-700 border-gray-200";
                return (
                  <Card
                    key={stat.division}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() =>
                      navigate(`/equipment/division/${encodeURIComponent(stat.division)}`)
                    }
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>
                          {stat.division}
                        </Badge>
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">טכנאים פעילים</p>
                          <p className="font-bold text-lg">{stat.activeCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">בשטח כעת</p>
                          <p className="font-bold text-lg">{stat.inField}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">יצאו (סה"כ)</p>
                          <p className="font-semibold">{stat.totalTaken}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">הוחזרו (סה"כ)</p>
                          <p className="font-semibold">{stat.totalReturned}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <p className="text-xs text-muted-foreground">אחוז החזרה:</p>
                        <span className={`text-sm font-bold ${returnPctColor(stat.returnPct)}`}>
                          {stat.returnPct}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Bonded divisions */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              חטיבות בונד
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {divisionStats.filter((s) => BONDED_DIVISIONS.has(s.division)).map((stat) => {
                const colorClass =
                  DIVISION_COLORS[stat.division] ?? "bg-gray-100 text-gray-700 border-gray-200";
                return (
                  <Card
                    key={stat.division}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() =>
                      navigate(`/equipment/division/${encodeURIComponent(stat.division)}`)
                    }
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>
                          {stat.division}
                        </Badge>
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1.5 col-span-1">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">ישות מסחרית</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">בשטח כעת</p>
                          <p className="font-bold text-lg">{stat.inField}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">יצאו (סה"כ)</p>
                          <p className="font-semibold">{stat.totalTaken}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">הוחזרו (סה"כ)</p>
                          <p className="font-semibold">{stat.totalReturned}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <p className="text-xs text-muted-foreground">אחוז החזרה:</p>
                        <span className={`text-sm font-bold ${returnPctColor(stat.returnPct)}`}>
                          {stat.returnPct}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2: Pickups by day → division → technician ── */}
        <TabsContent value="pickups" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="כל החודשים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל החודשים</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedDivision} onValueChange={setSelectedDivision}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="כל החטיבות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל החטיבות</SelectItem>
                {DIVISIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pickupsByDay.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-md">
              אין הצטיידויות בפרק הזמן שנבחר
            </div>
          ) : (
            <div className="space-y-2">
              {pickupsByDay.map(([date, dayPickups]) => {
                const dayExpanded = expandedDays.has(date);
                const totalDayItems = dayPickups.reduce(
                  (s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0),
                  0
                );
                // Group by division
                const divMap = new Map<string, PickupRaw[]>();
                dayPickups.forEach((p) => {
                  const div = installerMap.get(p.installer_id)?.division ?? "אחר";
                  if (!divMap.has(div)) divMap.set(div, []);
                  divMap.get(div)!.push(p);
                });
                const divCount = divMap.size;

                return (
                  <Card key={date} className="overflow-hidden">
                    {/* Day header */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 select-none border-b"
                      onClick={() => toggleDay(date)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">
                          {format(new Date(date), "dd/MM/yy")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {divCount} חטיבות · {dayPickups.length} אירועים · {totalDayItems} פריטים
                        </span>
                      </div>
                      {dayExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
                    </div>

                    {dayExpanded && (
                      <div className="divide-y">
                        {[...divMap.entries()].map(([div, divPickups]) => {
                          const divKey = `${date}:${div}`;
                          const divExpanded = expandedDivInDay.has(divKey);
                          const divItems = divPickups.reduce(
                            (s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0),
                            0
                          );
                          const colorClass = DIVISION_COLORS[div] ?? "bg-gray-100 text-gray-700 border-gray-200";

                          return (
                            <div key={divKey}>
                              {/* Division row */}
                              <div
                                className="flex items-center justify-between px-5 py-2.5 cursor-pointer hover:bg-muted/20 select-none bg-muted/10"
                                onClick={() => toggleDivInDay(divKey)}
                              >
                                <div className="flex items-center gap-3">
                                  <Badge className={`text-xs border ${colorClass}`}>{div}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {divPickups.length} אירועים · {divItems} פריטים
                                  </span>
                                </div>
                                {divExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  : <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                              </div>

                              {divExpanded && (
                                <div className="divide-y bg-background">
                                  {divPickups.map((p) => {
                                    const installer = installerMap.get(p.installer_id);
                                    return (
                                      <div key={p.id} className="px-8 py-2 text-sm">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-medium">
                                            {installer?.name ?? "—"}
                                            {installer?.warehouse_number
                                              ? ` (${installer.warehouse_number})`
                                              : ""}
                                          </span>
                                          {p.notes && (
                                            <span className="text-xs text-muted-foreground">· {p.notes}</span>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                          {p.equipment_pickup_items.map((item, idx) => (
                                            <span key={idx} className="text-xs text-muted-foreground">
                                              {productMap.get(item.product_id)?.name ?? item.product_id}
                                              {" "}×{item.quantity}
                                              {item.serial_numbers && item.serial_numbers.length > 0 && (
                                                <span className="font-mono ms-1" dir="ltr">
                                                  ({item.serial_numbers.join(", ")})
                                                </span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 3: Field inventory grouped by division ── */}
        <TabsContent value="inventory" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">כמות כוללת בשטח</p>
                <p className="text-2xl font-bold text-blue-600">
                  {fieldInventory.reduce((s, i) => s + i.balance, 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">מוצרים שונים בשטח</p>
                <p className="text-2xl font-bold">
                  {new Set(fieldInventory.map((i) => i.productId)).size}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">טכנאים עם ציוד</p>
                <p className="text-2xl font-bold">
                  {new Set(fieldInventory.map((i) => i.installerId)).size}
                </p>
              </CardContent>
            </Card>
          </div>

          <Select value={selectedDivision} onValueChange={setSelectedDivision}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל החטיבות</SelectItem>
              {DIVISIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-md">
              אין ציוד בשטח
            </div>
          ) : (
            DIVISIONS.filter((div) => {
              if (selectedDivision !== "all") return div === selectedDivision;
              return inventoryByDivision.has(div);
            }).map((div) => {
              const items = inventoryByDivision.get(div) ?? [];
              if (items.length === 0) return null;
              const colorClass =
                DIVISION_COLORS[div] ?? "bg-gray-100 text-gray-700 border-gray-200";
              const totalInDiv = items.reduce((s, i) => s + i.balance, 0);
              const techCount = new Set(items.map((i) => i.installerId)).size;
              return (
                <Card key={div}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-2 p-3 border-b">
                      <Badge className={`border ${colorClass}`}>{div}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {totalInDiv} פריטים | {techCount} טכנאים
                      </span>
                    </div>
                    {/* Mobile stacked rows */}
                    <div className="md:hidden divide-y">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2.5 gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                            {item.sku && <p className="text-xs text-muted-foreground font-mono" dir="ltr">{item.sku}</p>}
                            <p className="text-xs text-muted-foreground">{item.installerName}</p>
                          </div>
                          <p className="font-bold text-foreground shrink-0">{item.balance}</p>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr
                            className="border-b bg-muted/50"
                            onContextMenu={trContextMenu(invColVis.hiddenCols, setInvMenu)}
                          >
                            {INVENTORY_COLS.map((col) =>
                              invColVis.isVisible(col.id) ? (
                                <th
                                  key={col.id}
                                  className="text-right p-3 font-semibold text-foreground"
                                  onContextMenu={colThContextMenu(col, setInvMenu)}
                                >
                                  {col.sortField ? (
                                    <button
                                      onClick={() => toggleInvSort(col.sortField!)}
                                      className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                                    >
                                      {col.label}
                                      <SortIcon
                                        field={col.sortField}
                                        currentField={invSortField}
                                        currentDir={invSortDir}
                                      />
                                    </button>
                                  ) : (
                                    col.label
                                  )}
                                </th>
                              ) : null
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                              {invColVis.isVisible("installer") && (
                                <td className="p-3">{item.installerName}</td>
                              )}
                              {invColVis.isVisible("product") && (
                                <td className="p-3">{item.productName}</td>
                              )}
                              {invColVis.isVisible("sku") && (
                                <td
                                  className="p-3 font-mono text-xs text-muted-foreground"
                                  dir="ltr"
                                >
                                  {item.sku ?? "—"}
                                </td>
                              )}
                              {invColVis.isVisible("balance") && (
                                <td className="p-3 font-bold">{item.balance}</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Tab 4: Dashboard ── */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "יצא לשטח",
                value: totalTakenAll,
                color: "text-blue-600",
                bg: "bg-blue-50",
                icon: Package,
              },
              {
                label: "בשטח כעת",
                value: totalTakenAll - totalReturnedAll,
                color: "text-indigo-600",
                bg: "bg-indigo-50",
                icon: TrendingDown,
              },
              {
                label: "הוחזר",
                value: totalReturnedAll,
                color: "text-green-600",
                bg: "bg-green-50",
                icon: PackageX,
              },
              {
                label: "טכנאים עם ציוד",
                value: new Set(fieldInventory.map((i) => i.installerId)).size,
                color: "text-amber-600",
                bg: "bg-amber-50",
                icon: Users,
              },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className={`inline-flex p-1.5 rounded-lg ${kpi.bg} mb-2`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-sm">Top 10 מוצרים לפי צריכה</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={topProductsData}
                    layout="vertical"
                    margin={{ right: 20, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      width={110}
                      orientation="right"
                    />
                    <ReTooltip />
                    <Bar dataKey="qty" name="כמות" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-sm">טרנד חודשי</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyTrendData} margin={{ right: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis orientation="right" tick={{ fontSize: 11 }} />
                    <ReTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="taken"
                      name="יצא"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="returned"
                      name="חזר"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <h3 className="font-semibold p-3 border-b text-sm">סיכום לפי חטיבה</h3>
              {/* Mobile rows */}
              <div className="md:hidden divide-y">
                {sortedDivisionStats.map((stat) => (
                  <div
                    key={stat.division}
                    className="flex items-center justify-between p-3 gap-3 cursor-pointer hover:bg-muted/20"
                    onClick={() => navigate(`/equipment/division/${encodeURIComponent(stat.division)}`)}
                  >
                    <div>
                      <Badge className={`border ${DIVISION_COLORS[stat.division] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                        {stat.division}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        טכנאים: {stat.activeCount} · יצאו: {stat.totalTaken} · חזרו: {stat.totalReturned}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="font-bold text-lg">{stat.inField}</p>
                      <p className={`text-xs font-medium ${returnPctColor(stat.returnPct)}`}>{stat.returnPct}%</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(dashColVis.hiddenCols, setDashMenu)}>
                      {DASHBOARD_COLS.map((col) =>
                        dashColVis.isVisible(col.id) ? (
                          <th
                            key={col.id}
                            className="text-right p-3 font-semibold text-foreground"
                            onContextMenu={colThContextMenu(col, setDashMenu)}
                          >
                            {col.sortField ? (
                              <button
                                onClick={() => toggleDashSort(col.sortField!)}
                                className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                              >
                                {col.label}
                                <SortIcon field={col.sortField} currentField={dashSortField} currentDir={dashSortDir} />
                              </button>
                            ) : col.label}
                          </th>
                        ) : null
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDivisionStats.map((stat) => (
                      <tr
                        key={stat.division}
                        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                        onClick={() => navigate(`/equipment/division/${encodeURIComponent(stat.division)}`)}
                      >
                        {dashColVis.isVisible("division") && (
                          <td className="p-3">
                            <Badge className={`border ${DIVISION_COLORS[stat.division] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                              {stat.division}
                            </Badge>
                          </td>
                        )}
                        {dashColVis.isVisible("active") && <td className="p-3">{stat.activeCount}</td>}
                        {dashColVis.isVisible("taken") && <td className="p-3">{stat.totalTaken}</td>}
                        {dashColVis.isVisible("returned") && <td className="p-3">{stat.totalReturned}</td>}
                        {dashColVis.isVisible("inField") && <td className="p-3 font-bold">{stat.inField}</td>}
                        {dashColVis.isVisible("pct") && (
                          <td className={`p-3 font-bold ${returnPctColor(stat.returnPct)}`}>
                            {stat.returnPct}%
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 5: Division-aware warehouse overview ── */}
        <TabsContent value="warehouses" className="mt-4 space-y-6">
          {centersLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Bonded division warehouse cards */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Warehouse className="h-3.5 w-3.5" />
                  מחסני חטיבות בונד
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...BONDED_DIVISIONS].map(div => {
                    const center = centers.find(c => c.division === div);
                    const inv = center ? centerInventory.filter(i => i.center_id === center.id) : [];
                    const totalQty = inv.reduce((s, i) => s + i.quantity, 0);
                    const lowCount = inv.filter(i => i.min_stock > 0 && i.quantity < i.min_stock).length;
                    const colorClass = DIVISION_COLORS[div] ?? "bg-gray-100 text-gray-700 border-gray-200";
                    return (
                      <Card
                        key={div}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(`/equipment/division/${encodeURIComponent(div)}`)}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>{div}</Badge>
                            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {center ? (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">מוצרים שונים</p>
                                <p className="font-bold text-lg">{inv.length}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">כמות כוללת</p>
                                <p className="font-bold text-lg">{totalQty}</p>
                              </div>
                              {lowCount > 0 && (
                                <div className="col-span-2 flex items-center gap-1.5 text-destructive text-xs font-medium">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {lowCount} מוצרים מתחת למינימום
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">אין מרכז הפצה מקושר</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Main center */}
              {(() => {
                const mainCenter = centers.find(c => c.is_main);
                if (!mainCenter) return null;
                const mainInv = centerInventory.filter(i => i.center_id === mainCenter.id);
                const mainTotal = mainInv.reduce((s, i) => s + i.quantity, 0);
                const mainLow = mainInv.filter(i => i.min_stock > 0 && i.quantity < i.min_stock).length;
                return (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      מרכז הפצה ראשי
                    </h3>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Warehouse className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-semibold">{mainCenter.name}</p>
                            {mainCenter.city && <p className="text-xs text-muted-foreground">{mainCenter.city}</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">מוצרים שונים</p>
                            <p className="font-bold text-xl">{mainInv.length}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">כמות כוללת</p>
                            <p className="font-bold text-xl">{mainTotal}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">מתחת למינימום</p>
                            <p className={`font-bold text-xl ${mainLow > 0 ? "text-destructive" : ""}`}>{mainLow}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {/* Recent transfers */}
              {centerTransfers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    העברות אחרונות
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      {/* Mobile rows */}
                      <div className="md:hidden divide-y">
                        {centerTransfers.map(tr => {
                          const fromCenter = centers.find(c => c.id === tr.from_center_id);
                          const toCenter = centers.find(c => c.id === tr.to_center_id);
                          const prod = products.find(p => p.id === tr.product_id);
                          return (
                            <div key={tr.id} className="flex items-center justify-between p-3 gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{prod?.name ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {fromCenter?.name ?? "—"} → {toCenter?.name ?? "—"}
                                </p>
                                <p className="text-xs text-muted-foreground">{tr.created_at.slice(0, 10)}</p>
                              </div>
                              <p className="font-bold text-foreground shrink-0">{tr.quantity}</p>
                            </div>
                          );
                        })}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-right p-3 font-semibold">תאריך</th>
                              <th className="text-right p-3 font-semibold">ממרכז</th>
                              <th className="text-right p-3 font-semibold">למרכז</th>
                              <th className="text-right p-3 font-semibold">מוצר</th>
                              <th className="text-right p-3 font-semibold">כמות</th>
                            </tr>
                          </thead>
                          <tbody>
                            {centerTransfers.map(tr => {
                              const fromCenter = centers.find(c => c.id === tr.from_center_id);
                              const toCenter = centers.find(c => c.id === tr.to_center_id);
                              const prod = products.find(p => p.id === tr.product_id);
                              return (
                                <tr key={tr.id} className="border-b hover:bg-muted/30">
                                  <td className="p-3 text-muted-foreground">{tr.created_at.slice(0, 10)}</td>
                                  <td className="p-3">{fromCenter?.name ?? "—"}</td>
                                  <td className="p-3">{toCenter?.name ?? "—"}</td>
                                  <td className="p-3">{prod?.name ?? "—"}</td>
                                  <td className="p-3 font-medium">{tr.quantity}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
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

      {/* Context menus */}
      {pickupMenu && (
        <ColContextMenu
          menu={pickupMenu}
          sortField={pickupSortField}
          sortDir={pickupSortDir}
          hiddenCols={pickupColVis.hiddenCols}
          onClose={closePickupMenu}
          onHide={pickupColVis.hide}
          onShow={pickupColVis.show}
          onSortAsc={(field) => {
            setPickupSortField(field);
            setPickupSortDir("asc");
            closePickupMenu();
          }}
          onSortDesc={(field) => {
            setPickupSortField(field);
            setPickupSortDir("desc");
            closePickupMenu();
          }}
        />
      )}
      {invMenu && (
        <ColContextMenu
          menu={invMenu}
          sortField={invSortField}
          sortDir={invSortDir}
          hiddenCols={invColVis.hiddenCols}
          onClose={closeInvMenu}
          onHide={invColVis.hide}
          onShow={invColVis.show}
          onSortAsc={(field) => {
            setInvSortField(field);
            setInvSortDir("asc");
            closeInvMenu();
          }}
          onSortDesc={(field) => {
            setInvSortField(field);
            setInvSortDir("desc");
            closeInvMenu();
          }}
        />
      )}
      {dashMenu && (
        <ColContextMenu
          menu={dashMenu}
          sortField={dashSortField}
          sortDir={dashSortDir}
          hiddenCols={dashColVis.hiddenCols}
          onClose={closeDashMenu}
          onHide={dashColVis.hide}
          onShow={dashColVis.show}
          onSortAsc={(field) => {
            setDashSortField(field);
            setDashSortDir("asc");
            closeDashMenu();
          }}
          onSortDesc={(field) => {
            setDashSortField(field);
            setDashSortDir("desc");
            closeDashMenu();
          }}
        />
      )}
    </div>
  );
}
