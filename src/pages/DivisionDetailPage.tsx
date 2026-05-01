import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  Package,
  PackageX,
  TrendingDown,
  Users,
  ChevronDown,
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
} from "lucide-react";
import { NewPickupDialog } from "@/components/equipment/NewPickupDialog";
import { NewReturnDialog } from "@/components/equipment/NewReturnDialog";
import { NewInstallerDialog } from "@/components/equipment/NewInstallerDialog";
import { Combobox } from "@/components/ui/combobox";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import { DIVISION_COLORS, BONDED_DIVISIONS } from "@/components/equipment/constants";
import { canEdit } from "@/lib/permissions";
import type { ColDef } from "@/hooks/useColumnVisibility";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import {
  ColContextMenu,
  useColMenu,
  colThContextMenu,
  trContextMenu,
} from "@/components/ui/ColContextMenu";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Installer {
  id: string;
  name: string;
  warehouse_number: number | null;
  division: string;
  status: string;
  coordinator: string | null;
  phone: string | null;
  entity_type: string | null;
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
  equipment_pickup_items: PickupItemRaw[];
}

interface ReturnItemRaw {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  reason_detail: string | null;
  is_actually_faulty: boolean | null;
  serial_numbers: string[] | null;
}

interface ReturnRaw {
  id: string;
  installer_id: string;
  return_date: string;
  notes: string | null;
  equipment_return_items: ReturnItemRaw[];
}

interface DivisionContact {
  id: string;
  division: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

interface DivisionProduct {
  id: string;
  product_id: string;
  field_stock: number;
  field_stock_updated_at: string | null;
  quarterly_demand: number | null;
  quarterly_demand_updated_at: string | null;
  notes: string | null;
  products: { id: string; name: string; sku: string; category: string };
}

// ─── Column Defs ─────────────────────────────────────────────────────────────

const TECH_COLS: ColDef[] = [
  { id: "name", label: "שם", sortField: "name" },
  { id: "warehouse", label: 'מחסן' },
  { id: "coordinator", label: "מתאם" },
  { id: "taken", label: "נלקחו", sortField: "taken" },
  { id: "returned", label: "הוחזרו", sortField: "returned" },
  { id: "balance", label: "בשטח", sortField: "balance" },
  { id: "status", label: "סטטוס", sortField: "status" },
];

const PICKUP_COLS: ColDef[] = [
  { id: "date", label: "תאריך", sortField: "date" },
  { id: "recipient", label: "מקבל", sortField: "recipient" },
  { id: "taken", label: "נלקחו", sortField: "taken" },
  { id: "notes", label: "הערות" },
];

const INV_COLS: ColDef[] = [
  { id: "installer", label: "טכנאי", sortField: "installer" },
  { id: "product", label: "מוצר", sortField: "product" },
  { id: "sku", label: 'מק"ט' },
  { id: "balance", label: "בשטח", sortField: "balance" },
];

const RETURN_COLS: ColDef[] = [
  { id: "date", label: "תאריך", sortField: "date" },
  { id: "recipient", label: "מחזיר", sortField: "recipient" },
  { id: "returned", label: "הוחזרו", sortField: "returned" },
];

const DP_COLS: ColDef[] = [
  { id: "product", label: "מוצר" },
  { id: "field_stock", label: "מלאי בשטח", sortField: "field_stock" },
  { id: "monthly_avg", label: "צריכה חודשית" },
  { id: "quarterly_demand", label: "דרישה לרבעון", sortField: "quarterly_demand" },
  { id: "main_stock", label: "מלאי מרכז לוגיסטי", sortField: "main_stock" },
  { id: "incoming_qty", label: 'עול"ב', sortField: "incoming_qty" },
  { id: "reorder_point", label: "נקודת הזמנה", sortField: "reorder_point" },
  { id: "last_pickup", label: "שינוי אחרון", sortField: "last_pickup" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function returnPctColor(pct: number) {
  if (pct <= 5) return "text-green-600";
  if (pct <= 15) return "text-yellow-600";
  return "text-red-600";
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

const ROLES = ["מנהל", "רכז", "טכנאי", "תמיכה", "אחר"];
const blankForm = () => ({ name: "", role: "אחר", phone: "", email: "", notes: "" });

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DivisionDetailPage() {
  const { divisionName } = useParams<{ divisionName: string }>();
  const navigate = useNavigate();
  const { products, currentUserPermissions } = useData();
  const { currentUser } = useAuth();

  const division = divisionName ? decodeURIComponent(divisionName) : "";

  // Division managers can only access their own division
  useEffect(() => {
    if (currentUser?.division && currentUser.division !== division) {
      navigate(`/equipment/division/${encodeURIComponent(currentUser.division)}`, { replace: true });
    }
  }, [currentUser, division, navigate]);

  const [installers, setInstallers] = useState<Installer[]>([]);
  const [pickups, setPickups] = useState<PickupRaw[]>([]);
  const [returns, setReturns] = useState<ReturnRaw[]>([]);
  const [contacts, setContacts] = useState<DivisionContact[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedPickupId, setExpandedPickupId] = useState<string | null>(null);
  const [showNewPickup, setShowNewPickup] = useState(false);
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);

  // Installer edit/delete state
  const [editingInstallerData, setEditingInstallerData] = useState<Installer | null>(null);
  const [showEditInstaller, setShowEditInstaller] = useState(false);
  const [deletingInstallerId, setDeletingInstallerId] = useState<string | null>(null);

  // Pickup edit/delete state (full dialog)
  const [editingPickupData, setEditingPickupData] = useState<PickupRaw | null>(null);
  const [showEditPickup, setShowEditPickup] = useState(false);
  const [deletingPickupId, setDeletingPickupId] = useState<string | null>(null);

  // Return edit/delete/expand state
  const [expandedReturnId, setExpandedReturnId] = useState<string | null>(null);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);
  const [returnEditDate, setReturnEditDate] = useState("");
  const [returnEditNotes, setReturnEditNotes] = useState("");
  const [savingReturnEdit, setSavingReturnEdit] = useState(false);
  const [deletingReturnId, setDeletingReturnId] = useState<string | null>(null);

  // Division products state
  const [divisionProducts, setDivisionProducts] = useState<DivisionProduct[]>([]);
  const [dpSortField, setDpSortField] = useState<string | null>("product");
  const [dpSortDir, setDpSortDir] = useState<"asc" | "desc">("asc");
  const [editingDpId, setEditingDpId] = useState<string | null>(null);
  const [dpEditField, setDpEditField] = useState<"field_stock" | "quarterly_demand">("field_stock");
  const [dpEditVal, setDpEditVal] = useState<string>("");
  const [savingDp, setSavingDp] = useState(false);

  // Bonded entity inline edit state
  const [showEditBonded, setShowEditBonded] = useState(false);
  const [bondedEditForm, setBondedEditForm] = useState({ warehouse_number: "", coordinator: "", phone: "", status: "פעיל" });
  const [savingBondedEdit, setSavingBondedEdit] = useState(false);

  // Contact form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(blankForm());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort state
  const [techSortField, setTechSortField] = useState<string | null>("name");
  const [techSortDir, setTechSortDir] = useState<"asc" | "desc">("asc");
  const [pickupSortField, setPickupSortField] = useState<string | null>("date");
  const [pickupSortDir, setPickupSortDir] = useState<"asc" | "desc">("desc");
  const [invSortField, setInvSortField] = useState<string | null>("installer");
  const [invSortDir, setInvSortDir] = useState<"asc" | "desc">("asc");
  const [returnSortField, setReturnSortField] = useState<string | null>("date");
  const [returnSortDir, setReturnSortDir] = useState<"asc" | "desc">("desc");

  // Column visibility
  const techColVis = useColumnVisibility("division-technicians:hidden-columns", TECH_COLS);
  const pickupColVis = useColumnVisibility("division-pickups:hidden-columns", PICKUP_COLS);
  const invColVis = useColumnVisibility("division-inventory:hidden-columns", INV_COLS);
  const returnColVis = useColumnVisibility("division-returns:hidden-columns", RETURN_COLS);
  const { menu: techMenu, setMenu: setTechMenu, closeMenu: closeTechMenu } = useColMenu();
  const { menu: pickupMenu, setMenu: setPickupMenu, closeMenu: closePickupMenu } = useColMenu();
  const { menu: invMenu, setMenu: setInvMenu, closeMenu: closeInvMenu } = useColMenu();
  const { menu: returnMenu, setMenu: setReturnMenu, closeMenu: closeReturnMenu } = useColMenu();
  const dpColVis = useColumnVisibility(
    "division-products:hidden-columns",
    DP_COLS,
    ["main_stock", "incoming_qty", "reorder_point"]
  );
  const { menu: dpMenu, setMenu: setDpMenu, closeMenu: closeDpMenu } = useColMenu();
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const installerMap = useMemo(() => new Map(installers.map((i) => [i.id, i])), [installers]);

  const fetchData = useCallback(async () => {
    if (!division) return;
    setLoading(true);

    // Fetch installers — if entity_type column causes a schema-cache error, retry without it
    let divInstallers: Installer[] = [];
    {
      const instRes = await supabase
        .from("installers")
        .select("id, name, warehouse_number, division, status, coordinator, phone, entity_type")
        .eq("division", division)
        .order("name");

      if (instRes.error) {
        if (instRes.error.message?.includes("schema cache") || instRes.error.message?.includes("PGRST")) {
          const fallback = await supabase
            .from("installers")
            .select("id, name, warehouse_number, division, status, coordinator, phone")
            .eq("division", division)
            .order("name");
          divInstallers = (fallback.data ?? []) as Installer[];
        } else {
          toast.error("שגיאה בטעינת טכנאים");
        }
      } else {
        divInstallers = (instRes.data ?? []) as Installer[];
      }
    }

    const installerIds = divInstallers.map((i) => i.id);

    const [pickRes, retRes, contactRes] = await Promise.all([
      installerIds.length > 0
        ? supabase
            .from("equipment_pickups")
            .select(
              "id, installer_id, pickup_date, notes, equipment_pickup_items(id, product_id, quantity, serial_numbers)"
            )
            .in("installer_id", installerIds)
            .order("pickup_date", { ascending: false })
        : { data: [] as PickupRaw[], error: null },
      installerIds.length > 0
        ? supabase
            .from("equipment_returns")
            .select(
              "id, installer_id, return_date, notes, equipment_return_items(id, product_id, quantity, reason, reason_detail, is_actually_faulty, serial_numbers)"
            )
            .in("installer_id", installerIds)
            .order("return_date", { ascending: false })
        : { data: [] as ReturnRaw[], error: null },
      supabase
        .from("division_contacts")
        .select("*")
        .eq("division", division)
        .order("created_at"),
    ]);

    const dpRes = await supabase
      .from("division_products")
      .select("id, product_id, field_stock, field_stock_updated_at, quarterly_demand, quarterly_demand_updated_at, notes, products(id, name, sku, category)")
      .eq("division", division);

    setInstallers(divInstallers);
    setPickups(pickRes.error ? [] : (pickRes.data ?? []) as PickupRaw[]);
    setReturns(retRes.error ? [] : (retRes.data ?? []) as ReturnRaw[]);
    setContacts(contactRes.error ? [] : (contactRes.data ?? []) as DivisionContact[]);
    setDivisionProducts(dpRes.error ? [] : (dpRes.data ?? []) as unknown as DivisionProduct[]);

    if (pickRes.error) toast.error("שגיאה בטעינת הצטיידויות");
    if (retRes.error) toast.error("שגיאה בטעינת החזרות");

    setLoading(false);
  }, [division]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── KPI computations ──
  const totalTaken = useMemo(
    () => pickups.reduce((s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0), 0),
    [pickups]
  );
  const totalReturned = useMemo(
    () => returns.reduce((s, r) => s + r.equipment_return_items.reduce((ss, i) => ss + i.quantity, 0), 0),
    [returns]
  );
  const activeCount = useMemo(
    () => installers.filter((i) => i.status === "פעיל").length,
    [installers]
  );
  const returnPct = totalTaken > 0 ? Math.round((totalReturned / totalTaken) * 100) : 0;
  const inField = totalTaken - totalReturned;

  // ── Per-installer stats ──
  const installerStats = useMemo(() => {
    return installers.map((inst) => {
      const instPickups = pickups.filter((p) => p.installer_id === inst.id);
      const instReturns = returns.filter((r) => r.installer_id === inst.id);
      const taken = instPickups.reduce(
        (s, p) => s + p.equipment_pickup_items.reduce((ss, i) => ss + i.quantity, 0),
        0
      );
      const returned = instReturns.reduce(
        (s, r) => s + r.equipment_return_items.reduce((ss, i) => ss + i.quantity, 0),
        0
      );
      return { ...inst, taken, returned, balance: taken - returned };
    });
  }, [installers, pickups, returns]);

  const sortedInstallerStats = useMemo(() => {
    return [...installerStats].sort((a, b) => {
      const dir = techSortDir === "asc" ? 1 : -1;
      if (techSortField === "name") return a.name.localeCompare(b.name, "he") * dir;
      if (techSortField === "taken") return (a.taken - b.taken) * dir;
      if (techSortField === "returned") return (a.returned - b.returned) * dir;
      if (techSortField === "balance") return (a.balance - b.balance) * dir;
      if (techSortField === "status") return a.status.localeCompare(b.status, "he") * dir;
      return a.name.localeCompare(b.name, "he");
    });
  }, [installerStats, techSortField, techSortDir]);

  // ── Sorted pickups ──
  const sortedPickups = useMemo(() => {
    return [...pickups].sort((a, b) => {
      const dir = pickupSortDir === "asc" ? 1 : -1;
      if (pickupSortField === "date") return a.pickup_date.localeCompare(b.pickup_date) * dir;
      if (pickupSortField === "recipient") {
        const aName = installerMap.get(a.installer_id)?.name ?? "";
        const bName = installerMap.get(b.installer_id)?.name ?? "";
        return aName.localeCompare(bName, "he") * dir;
      }
      if (pickupSortField === "taken") {
        const aTaken = a.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0);
        const bTaken = b.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0);
        return (aTaken - bTaken) * dir;
      }
      return 0;
    });
  }, [pickups, pickupSortField, pickupSortDir, installerMap]);

  // ── Field inventory ──
  const fieldInventory = useMemo(() => {
    const map = new Map<
      string,
      { installerId: string; productId: string; taken: number; returned: number }
    >();
    pickups.forEach((p) => {
      p.equipment_pickup_items.forEach((item) => {
        const key = `${p.installer_id}:${item.product_id}`;
        if (!map.has(key))
          map.set(key, { installerId: p.installer_id, productId: item.product_id, taken: 0, returned: 0 });
        map.get(key)!.taken += item.quantity;
      });
    });
    returns.forEach((r) => {
      r.equipment_return_items.forEach((item) => {
        const key = `${r.installer_id}:${item.product_id}`;
        if (!map.has(key))
          map.set(key, { installerId: r.installer_id, productId: item.product_id, taken: 0, returned: 0 });
        map.get(key)!.returned += item.quantity;
      });
    });
    const items = [...map.values()]
      .map((e) => ({
        ...e,
        installerName: installerMap.get(e.installerId)?.name ?? e.installerId,
        productName: productMap.get(e.productId)?.name ?? e.productId,
        sku: productMap.get(e.productId)?.sku ?? null,
        balance: e.taken - e.returned,
      }))
      .filter((e) => e.balance > 0);

    return [...items].sort((a, b) => {
      const dir = invSortDir === "asc" ? 1 : -1;
      if (invSortField === "product")
        return a.productName.localeCompare(b.productName, "he") * dir;
      if (invSortField === "balance") return (a.balance - b.balance) * dir;
      return a.installerName.localeCompare(b.installerName, "he") * dir;
    });
  }, [pickups, returns, installerMap, productMap, invSortField, invSortDir]);

  // ── Sorted returns ──
  const sortedReturns = useMemo(() => {
    return [...returns].sort((a, b) => {
      const dir = returnSortDir === "asc" ? 1 : -1;
      if (returnSortField === "date") return a.return_date.localeCompare(b.return_date) * dir;
      if (returnSortField === "recipient") {
        const aName = installerMap.get(a.installer_id)?.name ?? "";
        const bName = installerMap.get(b.installer_id)?.name ?? "";
        return aName.localeCompare(bName, "he") * dir;
      }
      if (returnSortField === "returned") {
        const aRet = a.equipment_return_items.reduce((s, i) => s + i.quantity, 0);
        const bRet = b.equipment_return_items.reduce((s, i) => s + i.quantity, 0);
        return (aRet - bRet) * dir;
      }
      return 0;
    });
  }, [returns, returnSortField, returnSortDir, installerMap]);

  // ── Division products computed values ──
  const divisionInstallerIds = useMemo(
    () => new Set(installers.map((i) => i.id)),
    [installers]
  );

  const monthlyAvgByProduct = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    const totals = new Map<string, number>();
    for (const p of pickups) {
      if (!divisionInstallerIds.has(p.installer_id)) continue;
      if (new Date(p.pickup_date) < cutoff) continue;
      for (const item of p.equipment_pickup_items) {
        totals.set(item.product_id, (totals.get(item.product_id) ?? 0) + item.quantity);
      }
    }
    return new Map([...totals.entries()].map(([pid, t]) => [pid, Math.round((t / 3) * 10) / 10]));
  }, [pickups, divisionInstallerIds]);

  const lastPickupByProduct = useMemo(() => {
    const latest = new Map<string, string>();
    for (const p of pickups) {
      if (!divisionInstallerIds.has(p.installer_id)) continue;
      for (const item of p.equipment_pickup_items) {
        const cur = latest.get(item.product_id);
        if (!cur || p.pickup_date > cur) latest.set(item.product_id, p.pickup_date);
      }
    }
    return latest;
  }, [pickups, divisionInstallerIds]);

  const sortedDivisionProducts = useMemo(() => {
    return [...divisionProducts].sort((a, b) => {
      const dir = dpSortDir === "asc" ? 1 : -1;
      if (dpSortField === "field_stock") return (a.field_stock - b.field_stock) * dir;
      if (dpSortField === "quarterly_demand") return ((a.quarterly_demand ?? 0) - (b.quarterly_demand ?? 0)) * dir;
      if (dpSortField === "main_stock") {
        return ((productMap.get(a.product_id)?.stock_qty ?? 0) - (productMap.get(b.product_id)?.stock_qty ?? 0)) * dir;
      }
      if (dpSortField === "incoming_qty") {
        return ((productMap.get(a.product_id)?.incoming_qty ?? 0) - (productMap.get(b.product_id)?.incoming_qty ?? 0)) * dir;
      }
      if (dpSortField === "reorder_point") {
        return ((productMap.get(a.product_id)?.reorder_point ?? 0) - (productMap.get(b.product_id)?.reorder_point ?? 0)) * dir;
      }
      if (dpSortField === "last_pickup") {
        return (lastPickupByProduct.get(a.product_id) ?? "").localeCompare(lastPickupByProduct.get(b.product_id) ?? "") * dir;
      }
      return a.products.name.localeCompare(b.products.name, "he") * dir;
    });
  }, [divisionProducts, dpSortField, dpSortDir, lastPickupByProduct, productMap]);

  // ── Installer CRUD ──
  async function handleDeleteInstaller(id: string) {
    setDeletingInstallerId(id);
    const { error } = await supabase.from("installers").delete().eq("id", id);
    setDeletingInstallerId(null);
    if (error) toast.error("שגיאה במחיקת הטכנאי");
    else { toast.success("הטכנאי נמחק"); fetchData(); }
  }

  // ── Pickup delete ──
  async function handleDeletePickup(id: string) {
    setDeletingPickupId(id);
    await supabase.from("equipment_pickup_items").delete().eq("pickup_id", id);
    const { error } = await supabase.from("equipment_pickups").delete().eq("id", id);
    setDeletingPickupId(null);
    if (error) toast.error("שגיאה במחיקת ההצטיידות");
    else { toast.success("ההצטיידות נמחקה"); fetchData(); }
  }

  // ── Return edit/delete ──
  function startReturnEdit(r: ReturnRaw) {
    setEditingReturnId(r.id);
    setReturnEditDate(r.return_date);
    setReturnEditNotes(r.notes ?? "");
    setExpandedReturnId(r.id);
  }

  async function saveReturnEdit() {
    if (!editingReturnId) return;
    setSavingReturnEdit(true);
    const { error } = await supabase
      .from("equipment_returns")
      .update({ return_date: returnEditDate, notes: returnEditNotes.trim() || null })
      .eq("id", editingReturnId);
    setSavingReturnEdit(false);
    if (error) toast.error("שגיאה בעדכון ההחזרה");
    else { toast.success("ההחזרה עודכנה"); setEditingReturnId(null); fetchData(); }
  }

  async function handleDeleteReturn(id: string) {
    setDeletingReturnId(id);
    await supabase.from("equipment_return_items").delete().eq("return_id", id);
    const { error } = await supabase.from("equipment_returns").delete().eq("id", id);
    setDeletingReturnId(null);
    if (error) toast.error("שגיאה במחיקת ההחזרה");
    else { toast.success("ההחזרה נמחקה"); fetchData(); }
  }

  // ── Bonded entity edit ──
  async function saveBondedEdit() {
    if (!bondedInstaller) return;
    setSavingBondedEdit(true);
    const { error } = await supabase
      .from("installers")
      .update({
        warehouse_number: bondedEditForm.warehouse_number ? parseInt(bondedEditForm.warehouse_number) : null,
        coordinator: bondedEditForm.coordinator.trim() || null,
        phone: bondedEditForm.phone.trim() || null,
        status: bondedEditForm.status,
      })
      .eq("id", bondedInstaller.id);
    setSavingBondedEdit(false);
    if (error) toast.error("שגיאה בעדכון");
    else { toast.success("עודכן"); setShowEditBonded(false); fetchData(); }
  }

  // ── Division products CRUD ──
  async function saveDpField(dpId: string, field: "field_stock" | "quarterly_demand", rawVal: string) {
    const value = parseInt(rawVal) || 0;
    setSavingDp(true);
    const updates: Record<string, unknown> = { [field]: value };
    if (field === "field_stock") updates.field_stock_updated_at = new Date().toISOString();
    else updates.quarterly_demand_updated_at = new Date().toISOString();
    const { error } = await supabase.from("division_products").update(updates).eq("id", dpId);
    if (error) toast.error("שגיאה בשמירה");
    else setDivisionProducts((prev) =>
      prev.map((dp) => dp.id === dpId ? { ...dp, ...updates } as unknown as DivisionProduct : dp)
    );
    setEditingDpId(null);
    setSavingDp(false);
  }

  async function addProductToDivision(productId: string) {
    const { error } = await supabase.from("division_products").insert({ division, product_id: productId });
    if (error) toast.error("שגיאה בהוספת מוצר");
    else { fetchData(); toast.success("מוצר נוסף"); }
  }

  async function removeProductFromDivision(dpId: string) {
    const { error } = await supabase.from("division_products").delete().eq("id", dpId);
    if (error) toast.error("שגיאה במחיקה");
    else setDivisionProducts((prev) => prev.filter((dp) => dp.id !== dpId));
  }

  // ── Contact CRUD ──
  const handleAddContact = async () => {
    if (!form.name.trim()) { toast.error("יש להזין שם"); return; }
    setSaving(true);
    const { error } = await supabase.from("division_contacts").insert({
      division,
      name: form.name.trim(),
      role: form.role || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("שגיאה בהוספת איש קשר"); }
    else {
      toast.success("איש קשר נוסף");
      setForm(blankForm());
      setShowAddForm(false);
      fetchData();
    }
  };

  const startEdit = (c: DivisionContact) => {
    setEditingId(c.id);
    setEditForm({ name: c.name, role: c.role ?? "אחר", phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" });
  };

  const handleEditSave = async (id: string) => {
    if (!editForm.name.trim()) { toast.error("יש להזין שם"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("division_contacts")
      .update({ name: editForm.name.trim(), role: editForm.role || null, phone: editForm.phone.trim() || null, email: editForm.email.trim() || null, notes: editForm.notes.trim() || null })
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error("שגיאה בעדכון"); }
    else { toast.success("עודכן"); setEditingId(null); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("division_contacts").delete().eq("id", id);
    setDeletingId(null);
    if (error) { toast.error("שגיאה במחיקה"); }
    else { toast.success("נמחק"); fetchData(); }
  };

  function toggleTechSort(field: string) {
    if (techSortField === field) setTechSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setTechSortField(field); setTechSortDir("asc"); }
  }
  function togglePickupSort(field: string) {
    if (pickupSortField === field) setPickupSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPickupSortField(field); setPickupSortDir("desc"); }
  }
  function toggleInvSort(field: string) {
    if (invSortField === field) setInvSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setInvSortField(field); setInvSortDir("asc"); }
  }
  function toggleReturnSort(field: string) {
    if (returnSortField === field) setReturnSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setReturnSortField(field); setReturnSortDir("desc"); }
  }

  const colorClass = DIVISION_COLORS[division] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const isBonded = BONDED_DIVISIONS.has(division);
  const bondedInstaller = isBonded ? installers[0] ?? null : null;
  // System-wide users (no division assignment) get column-visibility controls;
  // division managers see the default fixed view.
  const canCustomizeColumns = !currentUser?.division;

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/equipment")} className="h-8 w-8">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>{division}</Badge>
            <span className="text-muted-foreground text-sm">פרטי חטיבה</span>
          </div>
        </div>
        <div className="flex gap-2">
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "כמות מוצרים", value: divisionProducts.length, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "יצאו (סה״כ)", value: totalTaken, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "הוחזרו (סה״כ)", value: totalReturned, icon: PackageX, color: "text-green-600", bg: "bg-green-50" },
          { label: "בשטח כעת", value: inField, icon: TrendingDown, color: returnPctColor(returnPct), bg: returnPct <= 5 ? "bg-green-50" : returnPct <= 15 ? "bg-yellow-50" : "bg-red-50" },
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

      {/* ── Section A: Technicians / Entity Profile ── */}
      {isBonded ? (
        bondedInstaller ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              פרופיל ישות
            </h2>
            {!showEditBonded && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                setBondedEditForm({
                  warehouse_number: bondedInstaller.warehouse_number ? String(bondedInstaller.warehouse_number) : "",
                  coordinator: bondedInstaller.coordinator ?? "",
                  phone: bondedInstaller.phone ?? "",
                  status: bondedInstaller.status ?? "פעיל",
                });
                setShowEditBonded(true);
              }}>
                <Pencil className="h-3 w-3 me-1" />
                עריכה
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-4">
              {showEditBonded ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">מחסן</Label>
                      <Input value={bondedEditForm.warehouse_number} onChange={(e) => setBondedEditForm((f) => ({ ...f, warehouse_number: e.target.value }))} className="h-7 text-sm" type="number" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">סטטוס</Label>
                      <Select value={bondedEditForm.status} onValueChange={(v) => setBondedEditForm((f) => ({ ...f, status: v }))}>
                        <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="פעיל">פעיל</SelectItem>
                          <SelectItem value="לא פעיל">לא פעיל</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">מתאם</Label>
                      <Input value={bondedEditForm.coordinator} onChange={(e) => setBondedEditForm((f) => ({ ...f, coordinator: e.target.value }))} className="h-7 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">טלפון</Label>
                      <Input value={bondedEditForm.phone} onChange={(e) => setBondedEditForm((f) => ({ ...f, phone: e.target.value }))} className="h-7 text-sm" dir="ltr" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowEditBonded(false)} disabled={savingBondedEdit}>ביטול</Button>
                    <Button size="sm" className="h-7 text-xs" onClick={saveBondedEdit} disabled={savingBondedEdit}>
                      {savingBondedEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 me-1" />}
                      שמור
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>{division}</Badge>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Building2 className="h-3 w-3" />
                      ישות מסחרית
                    </Badge>
                    <Badge
                      className={`text-xs ${
                        bondedInstaller.status === "פעיל"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {bondedInstaller.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {bondedInstaller.warehouse_number && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">מחסן</p>
                        <p className="font-medium">{bondedInstaller.warehouse_number}</p>
                      </div>
                    )}
                    {bondedInstaller.coordinator && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">מתאם</p>
                        <p className="font-medium">{bondedInstaller.coordinator}</p>
                      </div>
                    )}
                    {bondedInstaller.phone && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">טלפון</p>
                        <p className="font-medium" dir="ltr">{bondedInstaller.phone}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        ) : null
      ) : (
        <div>
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
            טכנאים
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b bg-muted/50"
                      onContextMenu={trContextMenu(techColVis.hiddenCols, setTechMenu)}
                    >
                      {TECH_COLS.map((col) =>
                        techColVis.isVisible(col.id) ? (
                          <th
                            key={col.id}
                            className="text-right p-3 font-semibold text-foreground"
                            onContextMenu={colThContextMenu(col, setTechMenu)}
                          >
                            {col.sortField ? (
                              <button
                                onClick={() => toggleTechSort(col.sortField!)}
                                className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                              >
                                {col.label}
                                <SortIcon field={col.sortField} currentField={techSortField} currentDir={techSortDir} />
                              </button>
                            ) : col.label}
                          </th>
                        ) : null
                      )}
                      <th className="p-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInstallerStats.length === 0 ? (
                      <tr>
                        <td colSpan={techColVis.visibleCount + 1} className="text-center p-8 text-muted-foreground">
                          אין טכנאים בחטיבה זו
                        </td>
                      </tr>
                    ) : (
                      sortedInstallerStats.map((inst) => (
                        <tr
                          key={inst.id}
                          className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          onClick={() => navigate(`/equipment/installer/${inst.id}`)}
                        >
                          {techColVis.isVisible("name") && (
                            <td className="p-3 font-medium">{inst.name}</td>
                          )}
                          {techColVis.isVisible("warehouse") && (
                            <td className="p-3 text-muted-foreground">
                              {inst.warehouse_number ?? "—"}
                            </td>
                          )}
                          {techColVis.isVisible("coordinator") && (
                            <td className="p-3 text-muted-foreground">{inst.coordinator ?? "—"}</td>
                          )}
                          {techColVis.isVisible("taken") && (
                            <td className="p-3">{inst.taken}</td>
                          )}
                          {techColVis.isVisible("returned") && (
                            <td className="p-3">{inst.returned}</td>
                          )}
                          {techColVis.isVisible("balance") && (
                            <td className="p-3 font-bold">{inst.balance}</td>
                          )}
                          {techColVis.isVisible("status") && (
                            <td className="p-3">
                              <Badge
                                className={`text-xs ${
                                  inst.status === "פעיל"
                                    ? "bg-green-100 text-green-700 hover:bg-green-100"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                                }`}
                              >
                                {inst.status}
                              </Badge>
                            </td>
                          )}
                          <td className="p-3 w-20" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => { setEditingInstallerData(inst); setShowEditInstaller(true); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteInstaller(inst.id)}
                                disabled={deletingInstallerId === inst.id}
                              >
                                {deletingInstallerId === inst.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Section: Division Products ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">מוצרי החטיבה</h2>
          <div className="flex gap-2">
            {(canEdit(currentUserPermissions, "equipment") || currentUser?.division === division) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewProduct(true)}
                >
                  <Plus className="h-4 w-4 me-1" />
                  צור מוצר חדש
                </Button>
                <div className="w-56">
                  <Combobox
                    value=""
                    onValueChange={(pid) => { if (pid) addProductToDivision(pid); }}
                    options={products
                      .filter((p) => !divisionProducts.some((dp) => dp.product_id === p.id))
                      .map((p) => ({ value: p.id, label: p.sku ? `${p.name} · ${p.sku}` : p.name }))}
                    placeholder="הוסף מוצר קיים..."
                    searchPlaceholder="חיפוש מוצר..."
                  />
                </div>
              </>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b bg-muted/50"
                    onContextMenu={canCustomizeColumns ? trContextMenu(dpColVis.hiddenCols, setDpMenu) : undefined}
                  >
                    {DP_COLS.map((col) =>
                      dpColVis.isVisible(col.id) ? (
                        <th
                          key={col.id}
                          className="text-right p-3 font-semibold text-foreground"
                          onContextMenu={canCustomizeColumns ? colThContextMenu(col, setDpMenu) : undefined}
                        >
                          {col.sortField ? (
                            <button
                              onClick={() => {
                                if (dpSortField === col.sortField) setDpSortDir((d) => (d === "asc" ? "desc" : "asc"));
                                else { setDpSortField(col.sortField!); setDpSortDir("asc"); }
                              }}
                              className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                            >
                              {col.label}
                              <SortIcon field={col.sortField} currentField={dpSortField} currentDir={dpSortDir} />
                            </button>
                          ) : col.label}
                        </th>
                      ) : null
                    )}
                    <th className="p-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedDivisionProducts.length === 0 ? (
                    <tr>
                      <td colSpan={dpColVis.visibleCount + 1} className="text-center p-8 text-muted-foreground">
                        לא נוספו מוצרים — הוסף מהרשימה הקיימת או צור מוצר חדש
                      </td>
                    </tr>
                  ) : sortedDivisionProducts.map((dp) => {
                    const monthlyAvg = monthlyAvgByProduct.get(dp.product_id) ?? 0;
                    const lastDate = lastPickupByProduct.get(dp.product_id);
                    const isEditingStock = editingDpId === dp.id && dpEditField === "field_stock";
                    const isEditingDemand = editingDpId === dp.id && dpEditField === "quarterly_demand";
                    return (
                      <tr key={dp.id} className="hover:bg-muted/30 transition-colors">
                        {dpColVis.isVisible("product") && (
                          <td className="p-3">
                            <div className="font-medium">{dp.products.name}</div>
                            <div className="flex gap-2 mt-0.5">
                              {dp.products.sku && (
                                <span className="font-mono text-xs text-muted-foreground">{dp.products.sku}</span>
                              )}
                              {dp.products.category && (
                                <span className="text-xs text-muted-foreground">· {dp.products.category}</span>
                              )}
                            </div>
                          </td>
                        )}
                        {dpColVis.isVisible("field_stock") && (
                          <td className="p-3">
                            {isEditingStock ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  value={dpEditVal}
                                  onChange={(e) => setDpEditVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveDpField(dp.id, "field_stock", dpEditVal);
                                    if (e.key === "Escape") setEditingDpId(null);
                                  }}
                                  onBlur={() => saveDpField(dp.id, "field_stock", dpEditVal)}
                                  className="h-7 w-20"
                                  autoFocus
                                  disabled={savingDp}
                                />
                              </div>
                            ) : (
                              <div
                                className={canEdit(currentUserPermissions, "equipment") ? "cursor-pointer hover:text-accent" : ""}
                                onClick={() => {
                                  if (!canEdit(currentUserPermissions, "equipment")) return;
                                  setEditingDpId(dp.id);
                                  setDpEditField("field_stock");
                                  setDpEditVal(String(dp.field_stock));
                                }}
                              >
                                <span className="font-medium">{dp.field_stock}</span>
                                {dp.field_stock_updated_at && (
                                  <div className="text-[10px] text-muted-foreground">
                                    עודכן: {format(new Date(dp.field_stock_updated_at), "dd/MM/yy")}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                        {dpColVis.isVisible("monthly_avg") && (
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={`text-xs ${monthlyAvg > 0 ? "border-green-300 text-green-700" : "border-muted text-muted-foreground"}`}
                            >
                              {monthlyAvg}
                            </Badge>
                          </td>
                        )}
                        {dpColVis.isVisible("quarterly_demand") && (
                          <td className="p-3">
                            {isEditingDemand ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  value={dpEditVal}
                                  onChange={(e) => setDpEditVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveDpField(dp.id, "quarterly_demand", dpEditVal);
                                    if (e.key === "Escape") setEditingDpId(null);
                                  }}
                                  onBlur={() => saveDpField(dp.id, "quarterly_demand", dpEditVal)}
                                  className="h-7 w-20"
                                  autoFocus
                                  disabled={savingDp}
                                />
                              </div>
                            ) : (
                              <div
                                className={canEdit(currentUserPermissions, "equipment") ? "cursor-pointer hover:text-accent" : ""}
                                onClick={() => {
                                  if (!canEdit(currentUserPermissions, "equipment")) return;
                                  setEditingDpId(dp.id);
                                  setDpEditField("quarterly_demand");
                                  setDpEditVal(String(dp.quarterly_demand ?? ""));
                                }}
                              >
                                <span className="font-medium">{dp.quarterly_demand ?? "—"}</span>
                                {dp.quarterly_demand_updated_at && (
                                  <div className="text-[10px] text-muted-foreground">
                                    עודכן: {format(new Date(dp.quarterly_demand_updated_at), "dd/MM/yy")}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                        {dpColVis.isVisible("main_stock") && (
                          <td className="p-3">
                            <span className="font-medium">{productMap.get(dp.product_id)?.stock_qty ?? "—"}</span>
                          </td>
                        )}
                        {dpColVis.isVisible("incoming_qty") && (
                          <td className="p-3">
                            {(productMap.get(dp.product_id)?.incoming_qty ?? 0) > 0 ? (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                {productMap.get(dp.product_id)?.incoming_qty}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        {dpColVis.isVisible("reorder_point") && (
                          <td className="p-3 text-muted-foreground">
                            {productMap.get(dp.product_id)?.reorder_point ?? "—"}
                          </td>
                        )}
                        {dpColVis.isVisible("last_pickup") && (
                          <td className="p-3 text-muted-foreground text-xs">
                            {lastDate ? format(new Date(lastDate), "dd/MM/yy") : "—"}
                          </td>
                        )}
                        <td className="p-3">
                          {(canEdit(currentUserPermissions, "equipment") || currentUser?.division === division) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeProductFromDivision(dp.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
      </div>

      {/* ── Section B: Pickups ── */}
      <div>
        <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
          הצטיידויות
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b bg-muted/50"
                    onContextMenu={trContextMenu(pickupColVis.hiddenCols, setPickupMenu)}
                  >
                    {PICKUP_COLS.map((col) =>
                      pickupColVis.isVisible(col.id) && !(isBonded && col.id === "recipient") ? (
                        <th
                          key={col.id}
                          className="text-right p-3 font-semibold text-foreground"
                          onContextMenu={colThContextMenu(col, setPickupMenu)}
                        >
                          {col.sortField ? (
                            <button
                              onClick={() => togglePickupSort(col.sortField!)}
                              className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                            >
                              {col.label}
                              <SortIcon field={col.sortField} currentField={pickupSortField} currentDir={pickupSortDir} />
                            </button>
                          ) : col.label}
                        </th>
                      ) : null
                    )}
                    <th className="p-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {sortedPickups.length === 0 ? (
                    <tr>
                      <td colSpan={pickupColVis.visibleCount + 2} className="text-center p-8 text-muted-foreground">
                        אין הצטיידויות עדיין
                      </td>
                    </tr>
                  ) : (
                    sortedPickups.map((p) => {
                      const installer = installerMap.get(p.installer_id);
                      const taken = p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0);
                      const expanded = expandedPickupId === p.id;
                      return (
                        <Fragment key={p.id}>
                          <tr
                            className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                            onClick={() => setExpandedPickupId(expanded ? null : p.id)}
                          >
                            {pickupColVis.isVisible("date") && (
                              <td className="p-3">{format(new Date(p.pickup_date), "dd/MM/yyyy")}</td>
                            )}
                            {pickupColVis.isVisible("recipient") && !isBonded && (
                              <td className="p-3">{installer?.name ?? "—"}</td>
                            )}
                            {pickupColVis.isVisible("taken") && (
                              <td className="p-3 font-medium">{taken}</td>
                            )}
                            {pickupColVis.isVisible("notes") && (
                              <td className="p-3 text-xs text-muted-foreground">{p.notes ?? "—"}</td>
                            )}
                            <td className="p-3 w-24" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => { setEditingPickupData(p); setShowEditPickup(true); }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => handleDeletePickup(p.id)}
                                  disabled={deletingPickupId === p.id}
                                >
                                  {deletingPickupId === p.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                                {expanded
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={pickupColVis.visibleCount + 2} className="p-0">
                                <div className="bg-muted/20 px-6 py-3 border-b space-y-1">
                                  {p.equipment_pickup_items.map((item, idx) => (
                                    <div key={idx} className="flex gap-4 text-xs">
                                      <span className="font-medium">
                                        {productMap.get(item.product_id)?.name ?? item.product_id}
                                      </span>
                                      <span className="text-muted-foreground">כמות: {item.quantity}</span>
                                      {item.serial_numbers && item.serial_numbers.length > 0 && (
                                        <span className="text-muted-foreground font-mono" dir="ltr">
                                          {item.serial_numbers.join(", ")}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section C: Returns ── */}
      <div>
        <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
          החזרות
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b bg-muted/50"
                    onContextMenu={trContextMenu(returnColVis.hiddenCols, setReturnMenu)}
                  >
                    {RETURN_COLS.map((col) =>
                      returnColVis.isVisible(col.id) && !(isBonded && col.id === "recipient") ? (
                        <th
                          key={col.id}
                          className="text-right p-3 font-semibold text-foreground"
                          onContextMenu={colThContextMenu(col, setReturnMenu)}
                        >
                          {col.sortField ? (
                            <button
                              onClick={() => toggleReturnSort(col.sortField!)}
                              className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                            >
                              {col.label}
                              <SortIcon field={col.sortField} currentField={returnSortField} currentDir={returnSortDir} />
                            </button>
                          ) : col.label}
                        </th>
                      ) : null
                    )}
                    <th className="p-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {sortedReturns.length === 0 ? (
                    <tr>
                      <td colSpan={returnColVis.visibleCount + 2} className="text-center p-8 text-muted-foreground">
                        אין החזרות עדיין
                      </td>
                    </tr>
                  ) : (
                    sortedReturns.map((r) => {
                      const installer = installerMap.get(r.installer_id);
                      const totalReturned = r.equipment_return_items.reduce((s, i) => s + i.quantity, 0);
                      const expanded = expandedReturnId === r.id;
                      const isEditing = editingReturnId === r.id;
                      return (
                        <Fragment key={r.id}>
                          <tr
                            className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                            onClick={() => !isEditing && setExpandedReturnId(expanded ? null : r.id)}
                          >
                            {returnColVis.isVisible("date") && (
                              <td className="p-3">{format(new Date(r.return_date), "dd/MM/yyyy")}</td>
                            )}
                            {returnColVis.isVisible("recipient") && !isBonded && (
                              <td className="p-3">{installer?.name ?? "—"}</td>
                            )}
                            {returnColVis.isVisible("returned") && (
                              <td className="p-3 font-medium">{totalReturned}</td>
                            )}
                            <td className="p-3 w-24" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => isEditing ? setEditingReturnId(null) : startReturnEdit(r)}
                                >
                                  {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteReturn(r.id)}
                                  disabled={deletingReturnId === r.id}
                                >
                                  {deletingReturnId === r.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                                {!isEditing && (
                                  expanded
                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={returnColVis.visibleCount + 2} className="p-0">
                                <div className="bg-muted/20 px-6 py-3 border-b space-y-2">
                                  {isEditing ? (
                                    <div className="space-y-2 max-w-sm" onClick={(e) => e.stopPropagation()}>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">תאריך</Label>
                                          <Input
                                            type="date"
                                            value={returnEditDate}
                                            onChange={(e) => setReturnEditDate(e.target.value)}
                                            className="h-7 text-sm"
                                            dir="ltr"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">הערות</Label>
                                          <Input
                                            value={returnEditNotes}
                                            onChange={(e) => setReturnEditNotes(e.target.value)}
                                            placeholder="הערות..."
                                            className="h-7 text-sm"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button size="sm" className="h-7 text-xs" onClick={saveReturnEdit} disabled={savingReturnEdit}>
                                          {savingReturnEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 me-1" />}
                                          שמור
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingReturnId(null)} disabled={savingReturnEdit}>
                                          ביטול
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {r.equipment_return_items.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 text-xs">
                                          <span className="font-medium">
                                            {productMap.get(item.product_id)?.name ?? item.product_id}
                                          </span>
                                          <span className="text-muted-foreground">כמות: {item.quantity}</span>
                                          <Badge variant="outline" className="text-[10px] h-4 py-0">{item.reason}</Badge>
                                          {item.serial_numbers && item.serial_numbers.length > 0 && (
                                            <span className="text-muted-foreground font-mono" dir="ltr">
                                              {item.serial_numbers.join(", ")}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section D: Field Inventory ── */}
      <div>
        <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
          מלאי בשטח
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b bg-muted/50"
                    onContextMenu={trContextMenu(invColVis.hiddenCols, setInvMenu)}
                  >
                    {INV_COLS.map((col) =>
                      invColVis.isVisible(col.id) && !(isBonded && col.id === "installer") ? (
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
                              <SortIcon field={col.sortField} currentField={invSortField} currentDir={invSortDir} />
                            </button>
                          ) : col.label}
                        </th>
                      ) : null
                    )}
                  </tr>
                </thead>
                <tbody>
                  {fieldInventory.length === 0 ? (
                    <tr>
                      <td colSpan={invColVis.visibleCount} className="text-center p-8 text-muted-foreground">
                        אין ציוד בשטח
                      </td>
                    </tr>
                  ) : (
                    fieldInventory.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                        {invColVis.isVisible("installer") && !isBonded && <td className="p-3">{item.installerName}</td>}
                        {invColVis.isVisible("product") && <td className="p-3">{item.productName}</td>}
                        {invColVis.isVisible("sku") && (
                          <td className="p-3 font-mono text-xs text-muted-foreground" dir="ltr">
                            {item.sku ?? "—"}
                          </td>
                        )}
                        {invColVis.isVisible("balance") && <td className="p-3 font-bold">{item.balance}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section E: Contacts ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            אנשי קשר
          </h2>
          {!showAddForm && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddForm(true)}>
              <Plus className="h-3 w-3 me-1" />
              הוסף
            </Button>
          )}
        </div>

        {showAddForm && (
          <Card className="mb-3">
            <CardContent className="p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">שם *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="שם מלא" className="h-7 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">תפקיד</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                    <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">טלפון</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="05X-XXXXXXX" className="h-7 text-sm" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">אימייל</Label>
                  <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@..." className="h-7 text-sm" dir="ltr" />
                </div>
              </div>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="הערות..." className="h-7 text-sm" />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddForm(false); setForm(blankForm()); }} disabled={saving}>ביטול</Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleAddContact} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "שמור"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {contacts.length === 0 ? (
          <div className="text-center py-6 border rounded-md text-sm text-muted-foreground">
            אין אנשי קשר עדיין
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם</TableHead>
                    <TableHead className="text-right">תפקיד</TableHead>
                    <TableHead className="text-right">טלפון</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) =>
                    editingId === c.id ? (
                      <TableRow key={c.id} className="bg-muted/20">
                        <TableCell className="p-1.5">
                          <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="h-7 text-sm" />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                            <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="h-7 text-sm" dir="ltr" />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleEditSave(c.id)} disabled={saving}>
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-sm py-2">
                          <div>{c.name}</div>
                          {c.email && <div className="text-[11px] text-muted-foreground" dir="ltr">{c.email}</div>}
                          {c.notes && <div className="text-[11px] text-muted-foreground">{c.notes}</div>}
                        </TableCell>
                        <TableCell className="text-sm py-2">
                          {c.role && <Badge variant="secondary" className="text-xs">{c.role}</Badge>}
                        </TableCell>
                        <TableCell className="text-sm py-2" dir="ltr">{c.phone ?? "—"}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}>
                              {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <NewPickupDialog
        open={showNewPickup}
        onOpenChange={setShowNewPickup}
        onCreated={fetchData}
        divisionProductIds={divisionProducts.map((dp) => dp.product_id)}
      />
      <NewPickupDialog
        open={showEditPickup}
        onOpenChange={(open) => { setShowEditPickup(open); if (!open) setEditingPickupData(null); }}
        onCreated={fetchData}
        divisionProductIds={divisionProducts.map((dp) => dp.product_id)}
        editingPickup={editingPickupData ? {
          id: editingPickupData.id,
          installer_id: editingPickupData.installer_id,
          pickup_date: editingPickupData.pickup_date,
          notes: editingPickupData.notes,
          items: editingPickupData.equipment_pickup_items.map((i) => ({
            id: i.id,
            product_id: i.product_id,
            quantity: i.quantity,
            serial_numbers: i.serial_numbers,
          })),
        } : null}
      />
      <NewReturnDialog
        open={showNewReturn}
        onOpenChange={setShowNewReturn}
        onCreated={fetchData}
        divisionProductIds={divisionProducts.map((dp) => dp.product_id)}
      />
      <ProductFormDialog
        open={showNewProduct}
        onOpenChange={setShowNewProduct}
        presetDivision={division}
        onCreated={fetchData}
      />
      <NewInstallerDialog
        open={showEditInstaller}
        onOpenChange={(open) => { setShowEditInstaller(open); if (!open) setEditingInstallerData(null); }}
        onCreated={fetchData}
        installer={editingInstallerData ?? undefined}
        onUpdated={() => { setEditingInstallerData(null); fetchData(); }}
      />

      {/* Context menus */}
      {techMenu && (
        <ColContextMenu
          menu={techMenu}
          sortField={techSortField}
          sortDir={techSortDir}
          hiddenCols={techColVis.hiddenCols}
          onClose={closeTechMenu}
          onHide={techColVis.hide}
          onShow={techColVis.show}
          onSortAsc={(field) => { setTechSortField(field); setTechSortDir("asc"); closeTechMenu(); }}
          onSortDesc={(field) => { setTechSortField(field); setTechSortDir("desc"); closeTechMenu(); }}
        />
      )}
      {pickupMenu && (
        <ColContextMenu
          menu={pickupMenu}
          sortField={pickupSortField}
          sortDir={pickupSortDir}
          hiddenCols={pickupColVis.hiddenCols}
          onClose={closePickupMenu}
          onHide={pickupColVis.hide}
          onShow={pickupColVis.show}
          onSortAsc={(field) => { setPickupSortField(field); setPickupSortDir("asc"); closePickupMenu(); }}
          onSortDesc={(field) => { setPickupSortField(field); setPickupSortDir("desc"); closePickupMenu(); }}
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
          onSortAsc={(field) => { setInvSortField(field); setInvSortDir("asc"); closeInvMenu(); }}
          onSortDesc={(field) => { setInvSortField(field); setInvSortDir("desc"); closeInvMenu(); }}
        />
      )}
      {returnMenu && (
        <ColContextMenu
          menu={returnMenu}
          sortField={returnSortField}
          sortDir={returnSortDir}
          hiddenCols={returnColVis.hiddenCols}
          onClose={closeReturnMenu}
          onHide={returnColVis.hide}
          onShow={returnColVis.show}
          onSortAsc={(field) => { setReturnSortField(field); setReturnSortDir("asc"); closeReturnMenu(); }}
          onSortDesc={(field) => { setReturnSortField(field); setReturnSortDir("desc"); closeReturnMenu(); }}
        />
      )}
      {dpMenu && canCustomizeColumns && (
        <ColContextMenu
          menu={dpMenu}
          sortField={dpSortField}
          sortDir={dpSortDir}
          hiddenCols={dpColVis.hiddenCols}
          onClose={closeDpMenu}
          onHide={dpColVis.hide}
          onShow={dpColVis.show}
          onSortAsc={(field) => { setDpSortField(field); setDpSortDir("asc"); closeDpMenu(); }}
          onSortDesc={(field) => { setDpSortField(field); setDpSortDir("desc"); closeDpMenu(); }}
        />
      )}
    </div>
  );
}
