import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { OrderRequestDialog } from "@/components/orders/OrderRequestDialog";
import { RejectRequestDialog } from "@/components/orders/RejectRequestDialog";
import { OrderRequestsDashboard } from "@/components/orders/OrderRequestsDashboard";
import { RequestDetailPanel } from "@/components/orders/RequestDetailPanel";
import { BulkFulfillDialog } from "@/components/orders/BulkFulfillDialog";
import { ExcelImportDialog } from "@/components/orders/ExcelImportDialog";
import { SnapshotsDialog } from "@/components/orders/SnapshotsDialog";
import { OrderRequestNotificationSettings } from "@/components/orders/OrderRequestNotificationSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { usePersistedState } from "@/hooks/usePersistedState";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart, Plus, ClipboardList, Inbox,
  Search, X, ExternalLink, Pencil, Trash2, RotateCcw, Ban, Eye, Layers, Rows3, Rows4,
  AlertTriangle, Lightbulb, Download, Upload, Copy, Camera, Bell,
} from "lucide-react";
import { downloadCsv } from "./orderRequestExcel";
import type { ColDef } from "@/hooks/useColumnVisibility";
import type { OrderRequest } from "@/contexts/types";
import { DIVISIONS, BONDED_DIVISIONS } from "@/components/equipment/constants";
import { isDivisionManager } from "@/lib/permissions";
import {
  fmtNum, fmtPct, fmtMoney, urgencyClass, statusClass, STATUS_LABELS,
  utilizationColor, isOverdue, ageBadge, freeTextMatch, daysSince, suggestUrgency,
} from "./orderRequestUtils";
import { fetchDivisionStockMap, hydrateDivisionStock } from "./divisionStockHelpers";

const COLUMN_DEFS: ColDef[] = [
  { id: "division", label: "חטיבה", sortField: "division" },
  { id: "product", label: "מוצר", sortField: "product_name" },
  { id: "sku", label: "מק״ט", sortField: "product_sku" },
  { id: "supplier", label: "ספק", sortField: "supplier" },
  { id: "quantity", label: "כמות", sortField: "quantity" },
  { id: "required_to_order", label: "נדרש להזמין", sortField: "required_to_order" },
  { id: "main_warehouse_stock", label: "מלאי מחסן 1", sortField: "main_warehouse_stock" },
  { id: "division_stock", label: "מלאי חטיבה", sortField: "division_stock" },
  { id: "quarterly_forecast", label: "צפי רבעון", sortField: "quarterly_forecast" },
  { id: "utilization_pct", label: "% מימוש", sortField: "utilization_pct" },
  { id: "estimated_unit_price", label: "מחיר יח׳", sortField: "estimated_unit_price" },
  { id: "estimated_value", label: "ערך משוער" },
  { id: "urgency", label: "דחיפות", sortField: "urgency" },
  { id: "order_type", label: "סוג הזמנה" },
  { id: "order_execution_date", label: "תאריך ביצוע", sortField: "order_execution_date" },
  { id: "consumption", label: "צריכה" },
  { id: "reason", label: "סיבה" },
  { id: "created_by", label: "נשלחה ע״י" },
  { id: "created_at", label: "נשלחה ב", sortField: "created_at" },
  { id: "age", label: "ימי המתנה" },
  { id: "status", label: "סטטוס", sortField: "status" },
  { id: "ordered_by", label: "טופלה ע״י" },
  { id: "ordered_at", label: "תאריך הזמנה", sortField: "ordered_at" },
];

function SortIcon({ field, currentField, currentDir }: { field: string; currentField: string | null; currentDir: "asc" | "desc" }) {
  if (currentField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function OrderRequestsTab() {
  const navigate = useNavigate();
  const { addOrder, suppliers, products } = useData();
  const { currentUser } = useAuth();

  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = usePersistedState<"all" | "pending" | "ordered" | "rejected" | "cancelled" | "active">(
    "order-requests:status-filter", "active"
  );
  const [divisionFilter, setDivisionFilter] = usePersistedState<string>("order-requests:division-filter", "all");
  const [urgencyFilter, setUrgencyFilter] = usePersistedState<string>("order-requests:urgency-filter", "all");
  const [dateFrom, setDateFrom] = usePersistedState<string>("order-requests:date-from", "");
  const [dateTo, setDateTo] = usePersistedState<string>("order-requests:date-to", "");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = usePersistedState<string | null>("order-requests:sort-field", "created_at");
  const [sortDir, setSortDir] = usePersistedState<"asc" | "desc">("order-requests:sort-dir", "desc");
  const [fulfillingRequest, setFulfillingRequest] = useState<OrderRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<OrderRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<OrderRequest | null>(null);
  const [detailRequest, setDetailRequest] = useState<OrderRequest | null>(null);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [divisionProductIds, setDivisionProductIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkFulfill, setShowBulkFulfill] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [cloneTemplate, setCloneTemplate] = useState<OrderRequest | null>(null);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";
  const [groupBy, setGroupBy] = usePersistedState<"none" | "supplier" | "urgency">("order-requests:group-by", "none");
  const [density, setDensity] = usePersistedState<"comfortable" | "compact">("order-requests:density", "comfortable");
  const cellPadding = density === "compact" ? "p-1.5" : "p-3";

  // Bonded division managers can submit requests for their own division.
  // Procurement managers fulfill requests but don't create them here.
  const userDivision = currentUser?.division ?? "";
  const isManager = currentUser?.role === "MANAGER";
  const isDivMgr = isDivisionManager(currentUser);
  const canCreateRequest = isDivMgr && BONDED_DIVISIONS.has(userDivision);
  const canFulfill = isManager;
  const canEditRow = (req: OrderRequest) =>
    isManager || (isDivMgr && req.division === userDivision && req.status === "pending");
  const canDeleteRow = canEditRow;

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "manager-order-requests:hidden-columns",
    COLUMN_DEFS,
    isManager
      // Manager: hide low-value text fields by default; show planning numbers
      ? ["consumption", "reason", "ordered_by", "sku", "estimated_unit_price", "main_warehouse_stock", "quarterly_forecast"]
      // Division manager: hide division (their own), reviewer/ordered metadata
      : ["division", "ordered_by", "ordered_at", "consumption", "reason"]
  );
  const { menu, setMenu, closeMenu } = useColMenu();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    // Order requests + live division stock from division_products (single source of truth)
    const [reqRes, stockMap] = await Promise.all([
      supabase.from("order_requests").select("*").order("created_at", { ascending: false }),
      fetchDivisionStockMap(),
    ]);
    if (reqRes.error) {
      toast.error("שגיאה בטעינת בקשות");
    } else {
      const hydrated = hydrateDivisionStock((reqRes.data ?? []) as OrderRequest[], stockMap);
      setRequests(hydrated);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Realtime: refresh when any order request OR division_products row changes
  useEffect(() => {
    const ch = supabase
      .channel("order-requests-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_requests" }, () => {
        void fetchRequests();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "division_products" }, () => {
        void fetchRequests();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [fetchRequests]);

  useEffect(() => {
    if (!canCreateRequest) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("division_products")
        .select("product_id")
        .eq("division", userDivision);
      if (cancelled) return;
      if (error) { setDivisionProductIds([]); return; }
      setDivisionProductIds((data ?? []).map(d => d.product_id as string));
    })();
    return () => { cancelled = true; };
  }, [canCreateRequest, userDivision]);

  const dialogDivisionProducts = useMemo(
    () => divisionProductIds.map(product_id => ({
      product_id,
      products: { id: product_id, name: "", sku: "" },
    })),
    [divisionProductIds],
  );

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleOrderCreated = useCallback(async (orderId: string) => {
    if (!fulfillingRequest) return;
    const { error } = await supabase
      .from("order_requests")
      .update({
        status: "ordered",
        order_id: orderId,
        ordered_at: new Date().toISOString(),
        ordered_by: currentUser?.id ?? null,
        ordered_by_name: currentUser?.name ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: currentUser?.id ?? null,
        reviewed_by_name: currentUser?.name ?? null,
      })
      .eq("id", fulfillingRequest.id);
    if (error) { toast.error("שגיאה בעדכון הבקשה"); }
    else { toast.success("הבקשה סומנה כהוזמנה"); }
    setFulfillingRequest(null);
    await fetchRequests();
  }, [fulfillingRequest, currentUser, fetchRequests]);

  const handleDelete = useCallback(async (req: OrderRequest) => {
    if (!confirm(`למחוק את הבקשה "${req.product_name}"?`)) return;
    const { error } = await supabase.from("order_requests").delete().eq("id", req.id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    toast.success("הבקשה נמחקה");
    await fetchRequests();
  }, [fetchRequests]);

  const handleRevert = useCallback(async (req: OrderRequest) => {
    const { error } = await supabase
      .from("order_requests")
      .update({
        status: "pending",
        order_id: null,
        ordered_at: null,
        ordered_by: null,
        ordered_by_name: null,
        reject_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        reviewed_by_name: null,
      })
      .eq("id", req.id);
    if (error) { toast.error("שגיאה בהחזרה"); return; }
    toast.success("הבקשה הוחזרה לסטטוס ממתין");
    await fetchRequests();
  }, [fetchRequests]);

  const navigateToProduct = (productId?: string | null) => {
    if (productId) navigate(`/products/${productId}`);
  };
  const navigateToSupplierByName = (supplierName?: string | null) => {
    if (!supplierName) return;
    const s = suppliers.find(s => s.company === supplierName);
    if (s) navigate(`/suppliers/${s.id}`);
  };
  const navigateToOrder = (orderId?: string | null) => {
    if (orderId) navigate(`/orders?focus=${orderId}`);
  };

  // Keep the detail panel showing fresh data after refresh
  useEffect(() => {
    if (!detailRequest) return;
    const fresh = requests.find(r => r.id === detailRequest.id);
    if (fresh && fresh !== detailRequest) setDetailRequest(fresh);
  }, [requests, detailRequest]);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelected = () => setSelected(new Set());
  const selectedRequests = useMemo(() => requests.filter(r => selected.has(r.id) && r.status === "pending"), [requests, selected]);

  // Build the visible/filtered list. Division managers' requests are already
  // limited by RLS — but the division dropdown is hidden for them too, so the UI
  // never asks about other divisions.
  const filtered = useMemo(() => {
    return requests
      .filter(r => {
        if (statusFilter === "all") return true;
        if (statusFilter === "active") return r.status === "pending" || r.status === "ordered";
        return r.status === statusFilter;
      })
      .filter(r => divisionFilter === "all" || r.division === divisionFilter)
      .filter(r => urgencyFilter === "all" || r.urgency === urgencyFilter)
      .filter(r => {
        if (!dateFrom && !dateTo) return true;
        const t = new Date(r.created_at).getTime();
        if (dateFrom && t < new Date(dateFrom).getTime()) return false;
        if (dateTo && t > new Date(dateTo).getTime() + 86_400_000) return false;
        return true;
      })
      .filter(r => freeTextMatch(r, search))
      .sort((a, b) => {
        if (!sortField) return 0;
        const av = (a as Record<string, unknown>)[sortField] ?? "";
        const bv = (b as Record<string, unknown>)[sortField] ?? "";
        if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
  }, [requests, statusFilter, divisionFilter, urgencyFilter, dateFrom, dateTo, search, sortField, sortDir]);

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const orderedCount = requests.filter(r => r.status === "ordered").length;
  const rejectedCount = requests.filter(r => r.status === "rejected").length;

  const prefillProduct = fulfillingRequest?.product_id
    ? products.find(p => p.id === fulfillingRequest.product_id)
    : undefined;
  const prefillSupplier = prefillProduct?.supplier
    ? suppliers.find(s => s.company === prefillProduct.supplier)
    : (fulfillingRequest?.supplier ? suppliers.find(s => s.company === fulfillingRequest.supplier) : undefined);

  const headerSubtitle = pendingCount > 0
    ? <><span className="font-semibold text-amber-600">{pendingCount}</span> ממתינות · {orderedCount} הוזמנו{rejectedCount > 0 && <> · {rejectedCount} נדחו</>}</>
    : <>אין בקשות ממתינות · {orderedCount} הוזמנו</>;

  return (
    <div className="space-y-4" dir="rtl">
      {/* KPI dashboard */}
      <OrderRequestsDashboard
        requests={isDivMgr ? requests.filter(r => r.division === userDivision) : requests}
        scope={isManager ? "manager" : "division"}
        divisionLabel={isDivMgr ? userDivision : undefined}
      />

      {/* Header card with search + filters */}
      <div className="bg-card rounded-xl border shadow-sm p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">
                בקשות הזמנה{isDivMgr ? ` — ${userDivision}` : ""}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{headerSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Density toggle */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setDensity(d => d === "compact" ? "comfortable" : "compact")}
              title={density === "compact" ? "תצוגה רגילה" : "תצוגה מצומצמת"}
            >
              {density === "compact" ? <Rows3 className="h-4 w-4" /> : <Rows4 className="h-4 w-4" />}
            </Button>
            {/* Group-by toggle */}
            <Select value={groupBy} onValueChange={v => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="h-8 text-xs gap-1.5 px-2 w-auto">
                <Layers className="h-3 w-3" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא קיבוץ</SelectItem>
                <SelectItem value="supplier">לפי ספק</SelectItem>
                <SelectItem value="urgency">לפי דחיפות</SelectItem>
              </SelectContent>
            </Select>
            {/* Excel export */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              onClick={() => downloadCsv(filtered, `order-requests-${new Date().toISOString().slice(0, 10)}.csv`)}
              title="ייצא לאקסל"
            >
              <Download className="h-3.5 w-3.5" /> ייצוא
            </Button>
            {/* Excel import (bonded division managers only) */}
            {canCreateRequest && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setShowExcelImport(true)}
                title="ייבוא מאקסל"
              >
                <Upload className="h-3.5 w-3.5" /> ייבוא
              </Button>
            )}
            {/* Snapshots (managers only) */}
            {isManager && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setShowSnapshots(true)}
                title="צילומי מצב היסטוריים"
              >
                <Camera className="h-3.5 w-3.5" /> צילומים
              </Button>
            )}
            {/* Notification settings */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setShowNotifSettings(true)}
              title="הגדרות התראות"
            >
              <Bell className="h-3.5 w-3.5" />
            </Button>
            {canCreateRequest && (
              <Button size="sm" onClick={() => setShowNewRequest(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />בקשה חדשה
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs text-muted-foreground">חיפוש</label>
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="מוצר, מק״ט, ספק, הערות, מבקש..."
                className="h-9 text-sm pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="נקה חיפוש"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">סטטוס</label>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">פעילות (ממתינות + הוזמנו)</SelectItem>
                <SelectItem value="pending">ממתינות{pendingCount > 0 && ` (${pendingCount})`}</SelectItem>
                <SelectItem value="ordered">הוזמנו{orderedCount > 0 && ` (${orderedCount})`}</SelectItem>
                <SelectItem value="rejected">נדחו{rejectedCount > 0 && ` (${rejectedCount})`}</SelectItem>
                <SelectItem value="cancelled">בוטלו</SelectItem>
                <SelectItem value="all">הכל ({requests.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">דחיפות</label>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="דחוף">דחוף</SelectItem>
                <SelectItem value="רגיל">רגיל</SelectItem>
                <SelectItem value="נמוך">נמוך</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Division dropdown only for procurement managers (cross-division view) */}
          {!isDivMgr && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">חטיבה</label>
              <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל החטיבות</SelectItem>
                  {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Date range filter on created_at */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">מתאריך</label>
            <div className="relative">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm" />
              {dateFrom && (
                <button
                  onClick={() => setDateFrom("")}
                  className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="נקה תאריך"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">עד תאריך</label>
            <div className="relative">
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm" />
              {dateTo && (
                <button
                  onClick={() => setDateTo("")}
                  className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="נקה תאריך"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {canFulfill && selectedRequests.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl shadow-sm p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="font-semibold">{selectedRequests.length}</span> בקשות נבחרו ·
            <span className="text-muted-foreground"> סה״כ {fmtNum(selectedRequests.reduce((s, r) => s + (r.required_to_order ?? r.quantity ?? 0), 0))} יח׳</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={clearSelected}>בטל בחירה</Button>
            <Button size="sm" className="gap-1.5" onClick={() => setShowBulkFulfill(true)}>
              <ShoppingCart className="h-3.5 w-3.5" /> מימוש קבוצתי
            </Button>
          </div>
        </div>
      )}

      {/* Body: loading / empty / table */}
      {loading ? (
        <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
          <div className="inline-block h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3">טוען בקשות…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
          <div className="inline-flex h-12 w-12 rounded-full bg-muted items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">אין בקשות הזמנה</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || statusFilter !== "active" || divisionFilter !== "all" || urgencyFilter !== "all"
              ? "נסה לשנות את הסינון או החיפוש"
              : canCreateRequest
              ? "פתחו בקשה חדשה כדי להתחיל"
              : isManager
              ? "כשמנהלי חטיבה יפתחו בקשות, הן יופיעו כאן"
              : "טרם הוגשו בקשות עבור החטיבה שלך"}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {filtered.map(req => {
              const age = ageBadge(req);
              const estValue = (req.required_to_order ?? req.quantity ?? 0) * (req.estimated_unit_price ?? 0);
              return (
                <div key={req.id} className="bg-card rounded-xl border shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => navigateToProduct(req.product_id)}
                        disabled={!req.product_id}
                        className={`font-semibold text-foreground text-sm text-right ${req.product_id ? "hover:underline" : ""}`}
                      >
                        {req.product_name}
                      </button>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {!isDivMgr && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{req.division}</span>}
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{fmtNum(req.required_to_order ?? req.quantity)} יח׳</span>
                        {req.supplier && <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <button
                            onClick={() => navigateToSupplierByName(req.supplier)}
                            className="text-xs text-muted-foreground truncate hover:underline"
                          >
                            {req.supplier}
                          </button>
                        </>}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${statusClass(req.status)}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${urgencyClass(req.urgency)}`}>{req.urgency}</span>
                    {age && <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${age.cls}`}>{age.text}</span>}
                    {estValue > 0 && <span className="text-xs text-muted-foreground tabular-nums">{fmtMoney(estValue)}</span>}
                    <span className="text-xs text-muted-foreground">{format(new Date(req.created_at), "dd/MM/yyyy")}</span>
                    <div className="flex gap-1 ms-auto">
                      {canEditRow(req) && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingRequest(req)} aria-label="ערוך">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {req.status === "pending" && canFulfill && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setFulfillingRequest(req)}>
                          <ShoppingCart className="h-3 w-3" />הזמן
                        </Button>
                      )}
                      {req.status === "pending" && canFulfill && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => setRejectingRequest(req)} aria-label="דחה">
                          <Ban className="h-3 w-3" />
                        </Button>
                      )}
                      {req.status === "ordered" && req.order_id && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigateToOrder(req.order_id)} aria-label="פתח הזמנה">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {req.reject_reason && (
                    <div className="text-xs text-red-700 mt-2 border-t pt-2">סיבת דחייה: {req.reject_reason}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto" dir="rtl">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                <tr className="border-b" onContextMenu={trContextMenu(hiddenCols, setMenu)}>
                  {canFulfill && (
                    <th className="p-3 w-8">
                      <Checkbox
                        checked={selectedRequests.length > 0 && selectedRequests.length === filtered.filter(r => r.status === "pending").length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelected(new Set(filtered.filter(r => r.status === "pending").map(r => r.id)));
                          } else {
                            clearSelected();
                          }
                        }}
                        aria-label="בחר הכל"
                      />
                    </th>
                  )}
                  {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                    <th
                      key={col.id}
                      className={`text-right ${cellPadding} font-semibold text-foreground text-xs whitespace-nowrap`}
                      onContextMenu={colThContextMenu(col, setMenu)}
                    >
                      {col.sortField ? (
                        <button
                          onClick={() => toggleSort(col.sortField!)}
                          className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                        >
                          {col.label}
                          <SortIcon field={col.sortField} currentField={sortField} currentDir={sortDir} />
                        </button>
                      ) : col.label}
                    </th>
                  ) : null)}
                  <th className={`${cellPadding} w-32`} />
                </tr>
              </thead>
              <tbody className="divide-y">
                {(() => {
                  // Group rendering
                  const groupedFlat: { type: "group"; key: string; label: string; count: number; qty: number }[] = [];
                  const allRows: { type: "row"; req: OrderRequest }[] = [];
                  if (groupBy === "none") {
                    filtered.forEach(req => allRows.push({ type: "row", req }));
                  } else {
                    const buckets = new Map<string, OrderRequest[]>();
                    for (const req of filtered) {
                      const k = groupBy === "supplier" ? (req.supplier ?? "ללא ספק") : req.urgency;
                      if (!buckets.has(k)) buckets.set(k, []);
                      buckets.get(k)!.push(req);
                    }
                    for (const [k, rs] of buckets) {
                      const qty = rs.reduce((s, r) => s + (r.required_to_order ?? r.quantity ?? 0), 0);
                      groupedFlat.push({ type: "group", key: k, label: k, count: rs.length, qty });
                      rs.forEach(req => allRows.push({ type: "row", req }));
                    }
                  }
                  const rendered: React.ReactNode[] = [];
                  let groupIdx = 0;
                  let lastGroupKey: string | null = null;
                  for (const item of allRows) {
                    if (groupBy !== "none") {
                      const k = groupBy === "supplier" ? (item.req.supplier ?? "ללא ספק") : item.req.urgency;
                      if (k !== lastGroupKey) {
                        const g = groupedFlat[groupIdx++];
                        rendered.push(
                          <tr key={`g-${g.key}`} className="bg-muted/40 sticky top-9 z-[9]">
                            <td colSpan={(canFulfill ? 1 : 0) + visibleCount + 1} className={`${cellPadding} text-xs font-semibold`}>
                              <span className="text-foreground">{g.label}</span>
                              <span className="text-muted-foreground font-normal ms-2">· {g.count} בקשות · {fmtNum(g.qty)} יח׳</span>
                            </td>
                          </tr>
                        );
                        lastGroupKey = k;
                      }
                    }
                    const req = item.req;
                    const age = ageBadge(req);
                    const orderQty = req.required_to_order ?? req.quantity ?? 0;
                    const estValue = orderQty * (req.estimated_unit_price ?? 0);
                    const overdueDate = isOverdue(req.order_execution_date) && req.status === "pending";
                    const stale = (() => {
                      const d = daysSince(req.updated_at ?? req.created_at);
                      return d !== null && d >= 30;
                    })();
                    const suggested = suggestUrgency(req);
                    rendered.push(
                      <tr
                        key={req.id}
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${overdueDate ? "bg-red-50/40" : ""} ${selected.has(req.id) ? "bg-primary/5" : ""}`}
                        onClick={(e) => {
                          // Don't open detail when clicking buttons or checkboxes
                          if ((e.target as HTMLElement).closest("button, [role='checkbox'], input, a")) return;
                          setDetailRequest(req);
                        }}
                      >
                        {canFulfill && (
                          <td className={`${cellPadding} w-8`}>
                            {req.status === "pending" ? (
                              <Checkbox
                                checked={selected.has(req.id)}
                                onCheckedChange={() => toggleSelect(req.id)}
                                aria-label="בחר בקשה"
                              />
                            ) : null}
                          </td>
                        )}
                        {isVisible("division") && (
                          <td className={cellPadding}>
                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{req.division}</span>
                          </td>
                        )}
                        {isVisible("product") && (
                          <td className={`${cellPadding} font-medium text-foreground`}>
                            <div className="flex items-center gap-1.5">
                              {req.product_id ? (
                                <button onClick={(e) => { e.stopPropagation(); navigateToProduct(req.product_id); }} className="hover:underline text-right">
                                  {req.product_name}
                                </button>
                              ) : req.product_name}
                              {stale && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" aria-label="נתון מיושן" />}
                              {suggested && suggested !== req.urgency && (
                                <Lightbulb className="h-3 w-3 text-purple-600 shrink-0" aria-label={`מומלץ: ${suggested}`} />
                              )}
                            </div>
                          </td>
                        )}
                        {isVisible("sku") && <td className={`${cellPadding} text-muted-foreground text-xs`} dir="ltr">{req.product_sku ?? "—"}</td>}
                        {isVisible("supplier") && (
                          <td className={`${cellPadding} text-muted-foreground`}>
                            {req.supplier ? (
                              <button onClick={(e) => { e.stopPropagation(); navigateToSupplierByName(req.supplier); }} className="hover:underline text-right">
                                {req.supplier}
                              </button>
                            ) : "—"}
                          </td>
                        )}
                        {isVisible("quantity") && <td className={`${cellPadding} tabular-nums`}>{fmtNum(req.quantity)}</td>}
                        {isVisible("required_to_order") && (
                          <td className={`${cellPadding} tabular-nums font-semibold`}>
                            <span className={orderQty > 0 ? "text-foreground" : "text-muted-foreground"}>
                              {fmtNum(req.required_to_order)}
                            </span>
                          </td>
                        )}
                        {isVisible("main_warehouse_stock") && <td className={`${cellPadding} tabular-nums`}>{fmtNum(req.main_warehouse_stock)}</td>}
                        {isVisible("division_stock") && <td className={`${cellPadding} tabular-nums`}>{fmtNum(req.division_stock)}</td>}
                        {isVisible("quarterly_forecast") && <td className={`${cellPadding} tabular-nums`}>{fmtNum(req.quarterly_forecast)}</td>}
                        {isVisible("utilization_pct") && (
                          <td className={`${cellPadding} tabular-nums ${utilizationColor(req.utilization_pct)}`}>{fmtPct(req.utilization_pct)}</td>
                        )}
                        {isVisible("estimated_unit_price") && <td className={`${cellPadding} tabular-nums`}>{fmtMoney(req.estimated_unit_price)}</td>}
                        {isVisible("estimated_value") && <td className={`${cellPadding} tabular-nums`}>{estValue > 0 ? fmtMoney(estValue) : "—"}</td>}
                        {isVisible("urgency") && (
                          <td className={cellPadding}>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${urgencyClass(req.urgency)}`}>{req.urgency}</span>
                          </td>
                        )}
                        {isVisible("order_type") && <td className={`${cellPadding} text-muted-foreground text-xs`}>{req.order_type}</td>}
                        {isVisible("order_execution_date") && (
                          <td className={`${cellPadding} text-xs whitespace-nowrap ${overdueDate ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            {req.order_execution_date ? format(new Date(req.order_execution_date), "dd/MM/yyyy") : "—"}
                          </td>
                        )}
                        {isVisible("consumption") && <td className={`${cellPadding} text-muted-foreground tabular-nums`}>{req.current_consumption ?? "—"}</td>}
                        {isVisible("reason") && <td className={`${cellPadding} text-muted-foreground max-w-[180px] truncate`} title={req.reason ?? ""}>{req.reason ?? "—"}</td>}
                        {isVisible("created_by") && <td className={`${cellPadding} text-muted-foreground text-xs`}>{req.created_by_name ?? "—"}</td>}
                        {isVisible("created_at") && (
                          <td className={`${cellPadding} text-muted-foreground text-xs whitespace-nowrap`}>
                            {format(new Date(req.created_at), "dd/MM/yyyy")}
                          </td>
                        )}
                        {isVisible("age") && (
                          <td className={cellPadding}>
                            {age ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${age.cls}`}>
                                {age.text}
                              </span>
                            ) : "—"}
                          </td>
                        )}
                        {isVisible("status") && (
                          <td className={cellPadding}>
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border w-fit ${statusClass(req.status)}`}>
                                {STATUS_LABELS[req.status]}
                              </span>
                              {req.reject_reason && (
                                <span className="text-[11px] text-red-700" title={req.reject_reason}>
                                  {req.reject_reason.length > 24 ? req.reject_reason.slice(0, 24) + "…" : req.reject_reason}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {isVisible("ordered_by") && <td className={`${cellPadding} text-muted-foreground text-xs`}>{req.ordered_by_name ?? req.reviewed_by_name ?? "—"}</td>}
                        {isVisible("ordered_at") && (
                          <td className={`${cellPadding} text-muted-foreground text-xs whitespace-nowrap`}>
                            {req.ordered_at ? format(new Date(req.ordered_at), "dd/MM/yyyy") : "—"}
                          </td>
                        )}
                        <td className={cellPadding}>
                          <div className="flex gap-0.5 justify-end">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailRequest(req); }} title="פרטים מלאים">
                              <Eye className="h-3 w-3" />
                            </Button>
                            {canEditRow(req) && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingRequest(req); }} title="ערוך">
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            {canCreateRequest && req.division === userDivision && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setCloneTemplate(req); }} title="שכפל">
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                            {req.status === "pending" && canFulfill && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={(e) => { e.stopPropagation(); setFulfillingRequest(req); }}>
                                <ShoppingCart className="h-3 w-3" />הזמן
                              </Button>
                            )}
                            {req.status === "pending" && canFulfill && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={(e) => { e.stopPropagation(); setRejectingRequest(req); }} title="דחה">
                                <Ban className="h-3 w-3" />
                              </Button>
                            )}
                            {req.status === "ordered" && req.order_id && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); navigateToOrder(req.order_id); }} title="פתח הזמנה">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                            {(req.status === "rejected" || req.status === "cancelled") && canFulfill && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleRevert(req); }} title="החזר ל-ממתין">
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                            {canDeleteRow(req) && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(req); }} title="מחק">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return rendered;
                })()}
              </tbody>
              {/* Aggregations row */}
              <tfoot className="bg-muted/40">
                <tr className="border-t font-semibold text-xs">
                  <td colSpan={(canFulfill ? 1 : 0) + visibleCount + 1} className={`${cellPadding} text-muted-foreground`}>
                    מציג {filtered.length} מתוך {requests.length} בקשות ·
                    סה״כ נדרש להזמין: <span className="text-foreground tabular-nums">{fmtNum(filtered.reduce((s, r) => s + (r.required_to_order ?? r.quantity ?? 0), 0))}</span> יח׳
                    {(() => {
                      const v = filtered.reduce((s, r) => s + ((r.required_to_order ?? r.quantity ?? 0) * (r.estimated_unit_price ?? 0)), 0);
                      return v > 0 ? <> · ערך משוער: <span className="text-foreground tabular-nums">{fmtMoney(v)}</span></> : null;
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* New / edit / clone dialog */}
      {(canCreateRequest || editingRequest) && (
        <OrderRequestDialog
          open={showNewRequest || !!editingRequest || !!cloneTemplate}
          onOpenChange={(o) => {
            if (!o) { setShowNewRequest(false); setEditingRequest(null); setCloneTemplate(null); }
            else setShowNewRequest(true);
          }}
          division={editingRequest?.division ?? cloneTemplate?.division ?? userDivision}
          divisionProducts={dialogDivisionProducts}
          allProducts={products}
          onCreated={fetchRequests}
          editingRequest={editingRequest}
          template={cloneTemplate}
        />
      )}

      {/* Fulfill dialog (manager only) */}
      {fulfillingRequest && canFulfill && (() => {
        const r = fulfillingRequest;
        const notesParts = [
          r.reason && `סיבת הבקשה: ${r.reason}`,
          r.notes && `הערות תכנון: ${r.notes}`,
          r.current_consumption && `צריכה נוכחית: ${r.current_consumption}`,
          r.required_to_order != null && `נדרש להזמין: ${r.required_to_order}`,
          `נוצר על ידי: ${r.created_by_name ?? "—"} · חטיבה: ${r.division}`,
        ].filter(Boolean).join("\n");
        const priorityMap: Record<string, "דחוף" | "גבוה" | "בינוני" | "נמוך"> = {
          "דחוף": "דחוף", "רגיל": "בינוני", "נמוך": "נמוך",
        };
        return (
          <NewOrderDialog
            open={!!fulfillingRequest}
            onOpenChange={(open) => { if (!open) setFulfillingRequest(null); }}
            suppliers={suppliers}
            products={products}
            addOrder={addOrder}
            defaultProductId={r.product_id ?? undefined}
            defaultSupplierId={prefillSupplier?.id}
            defaultQuantity={r.required_to_order ?? r.quantity ?? undefined}
            defaultNotes={notesParts}
            defaultPriority={priorityMap[r.urgency] ?? "בינוני"}
            hideTrigger
            onOrderCreated={handleOrderCreated}
          />
        );
      })()}

      {/* Reject dialog */}
      <RejectRequestDialog
        open={!!rejectingRequest}
        onOpenChange={(o) => { if (!o) setRejectingRequest(null); }}
        requestId={rejectingRequest?.id ?? null}
        productName={rejectingRequest?.product_name}
        onRejected={fetchRequests}
      />

      {/* Bulk fulfill */}
      {showBulkFulfill && (
        <BulkFulfillDialog
          open={showBulkFulfill}
          onOpenChange={setShowBulkFulfill}
          requests={selectedRequests}
          addOrder={addOrder}
          onDone={() => { clearSelected(); fetchRequests(); }}
        />
      )}

      {/* Excel import */}
      {canCreateRequest && (
        <ExcelImportDialog
          open={showExcelImport}
          onOpenChange={setShowExcelImport}
          division={userDivision}
          existing={requests.filter(r => r.division === userDivision)}
          onDone={fetchRequests}
        />
      )}

      {/* Snapshots */}
      {isManager && (
        <SnapshotsDialog
          open={showSnapshots}
          onOpenChange={setShowSnapshots}
          division={undefined}
          current={requests}
        />
      )}

      {/* Notification settings */}
      <Dialog open={showNotifSettings} onOpenChange={setShowNotifSettings}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>הגדרות התראות</DialogTitle>
          </DialogHeader>
          <OrderRequestNotificationSettings vapidPublicKey={vapidPublicKey} />
        </DialogContent>
      </Dialog>

      {/* Detail panel */}
      <RequestDetailPanel
        request={detailRequest}
        onOpenChange={(o) => { if (!o) setDetailRequest(null); }}
        onEdit={(r) => { setDetailRequest(null); setEditingRequest(r); }}
        onFulfill={(r) => { setDetailRequest(null); setFulfillingRequest(r); }}
        onReject={(r) => { setDetailRequest(null); setRejectingRequest(r); }}
        onDelete={(r) => { setDetailRequest(null); void handleDelete(r); }}
        onRevert={(r) => { setDetailRequest(null); void handleRevert(r); }}
        onRefresh={fetchRequests}
        navigateToOrder={(id) => { setDetailRequest(null); navigate(`/orders?focus=${id}`); }}
        navigateToProduct={(id) => { setDetailRequest(null); navigate(`/products/${id}`); }}
        navigateToSupplier={(name) => {
          const s = suppliers.find(s => s.company === name);
          if (s) { setDetailRequest(null); navigate(`/suppliers/${s.id}`); }
        }}
      />

      {menu && (
        <ColContextMenu
          menu={menu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={(field) => { setSortField(field); setSortDir("asc"); closeMenu(); }}
          onSortDesc={(field) => { setSortField(field); setSortDir("desc"); closeMenu(); }}
        />
      )}
    </div>
  );
}
