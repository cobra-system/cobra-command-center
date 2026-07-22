import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData, useAuth, useProducts } from "@/contexts/AppContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { OrderRequestDialog } from "@/components/orders/OrderRequestDialog";
import { AttachToOrderDialog } from "@/components/orders/AttachToOrderDialog";
import { RejectRequestDialog } from "@/components/orders/RejectRequestDialog";
import { RequestDetailPanel } from "@/components/orders/RequestDetailPanel";
import { BulkFulfillDialog } from "@/components/orders/BulkFulfillDialog";
import { ExcelImportDialog } from "@/components/orders/ExcelImportDialog";
import { SnapshotsDialog } from "@/components/orders/SnapshotsDialog";
import { OrderRequestNotificationSettings } from "@/components/orders/OrderRequestNotificationSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { usePersistedState } from "@/hooks/usePersistedState";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart, Plus, ClipboardList, Inbox,
  Search, X, ExternalLink, Pencil, Ban,
  AlertTriangle, Download, Upload, Camera, Bell, MoreVertical, SlidersHorizontal,
} from "lucide-react";
import { downloadCsv } from "./orderRequestExcel";
import type { ColDef } from "@/hooks/useColumnVisibility";
import type { OrderRequest } from "@/contexts/types";
import { DIVISIONS, BONDED_DIVISIONS } from "@/components/equipment/constants";
import { isDivisionManager } from "@/lib/permissions";
import {
  fmtNum, fmtPct, urgencyClass, statusClass, STATUS_LABELS,
  utilizationColor, isOverdue, ageBadge, freeTextMatch, daysSince,
  URGENCY_OPTIONS, ORDER_TYPE_OPTIONS,
} from "./orderRequestUtils";
import { fetchDivisionStockMap, hydrateDivisionStock, updateDivisionStock } from "./divisionStockHelpers";
import { InlineEditCell } from "@/components/orders/InlineEditCell";
import { InlineSelectCell } from "@/components/orders/InlineSelectCell";

const COLUMN_DEFS: ColDef[] = [
  { id: "division", label: "חטיבה", sortField: "division" },
  { id: "product", label: "מוצר", sortField: "product_name" },
  { id: "sku", label: "מק״ט", sortField: "product_sku" },
  { id: "supplier", label: "ספק", sortField: "supplier" },
  { id: "required_to_order", label: "כמות", sortField: "required_to_order" },
  { id: "division_stock", label: "מלאי חטיבה", sortField: "division_stock" },
  { id: "utilization_pct", label: "% מימוש", sortField: "utilization_pct" },
  { id: "urgency", label: "דחיפות", sortField: "urgency" },
  { id: "order_type", label: "סוג הזמנה" },
  { id: "order_execution_date", label: "תאריך ביצוע", sortField: "order_execution_date" },
  { id: "consumption", label: "צריכה חודשית ממוצעת" },
  { id: "reason", label: "סיבה" },
  { id: "created_by", label: "נשלחה ע״י" },
  { id: "created_at", label: "נשלחה ב", sortField: "created_at" },
  { id: "age", label: "ימי המתנה" },
  { id: "status", label: "סטטוס", sortField: "status" },
  { id: "delivery_status", label: "סטטוס אספקה" },
  { id: "eta", label: "ETA" },
  { id: "ordered_by", label: "טופלה ע״י" },
  { id: "ordered_at", label: "תאריך הזמנה", sortField: "ordered_at" },
];

function SortIcon({ field, currentField, currentDir }: { field: string; currentField: string | null; currentDir: "asc" | "desc" }) {
  if (currentField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function OrderRequestsTab() {
  const navigate = useNavigate();
  const { addOrder, suppliers, products, orders } = useData();
  const { allProducts } = useProducts();
  const { currentUser } = useAuth();

  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = usePersistedState<"all" | "pending" | "ordered" | "rejected" | "cancelled" | "active">(
    "order-requests:status-filter", "active"
  );
  const [divisionFilter, setDivisionFilter] = usePersistedState<string>("order-requests:division-filter", "all");
  const [dateFrom, setDateFrom] = usePersistedState<string>("order-requests:date-from", "");
  const [dateTo, setDateTo] = usePersistedState<string>("order-requests:date-to", "");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = usePersistedState<string | null>("order-requests:sort-field", "created_at");
  const [sortDir, setSortDir] = usePersistedState<"asc" | "desc">("order-requests:sort-dir", "desc");
  const [fulfillingRequest, setFulfillingRequest] = useState<OrderRequest | null>(null);
  const [fulfillChooserRequest, setFulfillChooserRequest] = useState<OrderRequest | null>(null);
  const [attachingRequest, setAttachingRequest] = useState<OrderRequest | null>(null);
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
  const cellPadding = "p-1.5";

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
  const canEditDelivery = (req: OrderRequest) =>
    (isManager || (isDivMgr && req.division === userDivision)) && req.status === "ordered";

  const { isVisible, hide, show, hiddenCols } = useColumnVisibility(
    "manager-order-requests:hidden-columns",
    COLUMN_DEFS,
    isManager
      ? ["utilization_pct", "order_execution_date", "created_by", "created_at", "age", "ordered_by", "ordered_at", "delivery_status", "eta"]
      : ["division", "utilization_pct", "order_execution_date", "created_by", "created_at", "age", "ordered_by", "ordered_at", "delivery_status", "eta"]
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

  const fetchDivisionProductIds = useCallback(async () => {
    if (!canCreateRequest) return;
    const { data, error } = await supabase
      .from("division_products")
      .select("product_id")
      .eq("division", userDivision);
    if (error) { setDivisionProductIds([]); return; }
    setDivisionProductIds((data ?? []).map(d => d.product_id as string));
  }, [canCreateRequest, userDivision]);

  useEffect(() => { void fetchDivisionProductIds(); }, [fetchDivisionProductIds]);

  // Realtime: react to division_products changes (covers inline product creation +
  // attach-to-division popup) so the dialog's set is always fresh.
  useEffect(() => {
    if (!canCreateRequest) return;
    const ch = supabase
      .channel(`division-products-${userDivision}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "division_products", filter: `division=eq.${userDivision}` },
        () => { void fetchDivisionProductIds(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [canCreateRequest, userDivision, fetchDivisionProductIds]);

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
        linked_order_ids: [orderId],
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

  const patchRequest = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("order_requests").update(patch).eq("id", id);
    if (error) {
      toast.error("שגיאה בעדכון");
      return;
    }
    setRequests(prev => prev.map(r => r.id === id ? ({ ...r, ...patch } as OrderRequest) : r));
  }, []);

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
    if (orderId) navigate(`/orders/${orderId}`);
  };

  const updateDeliveryStatus = useCallback(async (reqId: string, val: string | null) => {
    const { error } = await supabase
      .from("order_requests")
      .update({ delivery_status: val })
      .eq("id", reqId);
    if (error) { toast.error("שגיאה בעדכון סטטוס אספקה"); return; }
    await fetchRequests();
  }, [fetchRequests]);

  // Resolve every order linked to a request. Falls back to the single order_id
  // for legacy rows where linked_order_ids hadn't been backfilled.
  const linkedOrdersFor = useCallback((req: OrderRequest) => {
    const ids = (req.linked_order_ids && req.linked_order_ids.length > 0)
      ? req.linked_order_ids
      : (req.order_id ? [req.order_id] : []);
    const byId = new Map(orders.map(o => [o.id, o]));
    return ids
      .map(id => byId.get(id) ?? { id, supplier_name: null, pi_number: null, order_date: null } as Pick<typeof orders[number], "id" | "supplier_name" | "pi_number" | "order_date">)
      .filter(Boolean);
  }, [orders]);

  const orderLabel = (o: { id: string; supplier_name?: string | null; pi_number?: string | null; order_date?: string | null }) => {
    const parts: string[] = [];
    if (o.pi_number) parts.push(`PI ${o.pi_number}`);
    if (o.supplier_name) parts.push(o.supplier_name);
    if (o.order_date) parts.push(format(new Date(o.order_date), "dd/MM/yyyy"));
    if (parts.length > 0) return parts.join(" · ");
    return `הזמנה ${o.id.slice(0, 8)}`;
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
      .filter(r => isDivMgr || divisionFilter === "all" || r.division === divisionFilter)
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
  }, [requests, statusFilter, divisionFilter, dateFrom, dateTo, search, sortField, sortDir]);

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
          {/* Extra filters (date range) hidden behind a popover */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">מסננים נוספים</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-full justify-between text-sm font-normal">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    תאריכים
                  </span>
                  {(dateFrom || dateTo) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="מסנן פעיל" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3" dir="rtl">
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
                {(dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                  >
                    נקה תאריכים
                  </Button>
                )}
              </PopoverContent>
            </Popover>
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
            {search || statusFilter !== "active" || (!isDivMgr && divisionFilter !== "all") || dateFrom || dateTo
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
                    <span className="text-xs text-muted-foreground">{format(new Date(req.created_at), "dd/MM/yyyy")}</span>
                    <div className="flex gap-1 ms-auto">
                      {canEditRow(req) && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingRequest(req)} aria-label="ערוך">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {req.status === "pending" && canFulfill && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setFulfillChooserRequest(req)}>
                          <ShoppingCart className="h-3 w-3" />הזמן
                        </Button>
                      )}
                      {req.status === "pending" && canFulfill && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => setRejectingRequest(req)} aria-label="דחה">
                          <Ban className="h-3 w-3" />
                        </Button>
                      )}
                      {req.status === "ordered" && (() => {
                        const linked = linkedOrdersFor(req);
                        if (linked.length === 0) return null;
                        if (linked.length === 1) {
                          return (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigateToOrder(linked[0].id)} aria-label="פתח הזמנה">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          );
                        }
                        return (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 px-1.5 text-xs gap-1" aria-label="פתח הזמנה">
                                <ExternalLink className="h-3 w-3" />
                                <span>{linked.length}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {linked.map(o => (
                                <DropdownMenuItem key={o.id} onClick={() => navigateToOrder(o.id)}>
                                  {orderLabel(o)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })()}
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
                  <th className={`${cellPadding} w-12 text-right font-semibold text-foreground text-xs`}>פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(req => {
                  const age = ageBadge(req);
                  const overdueDate = isOverdue(req.order_execution_date) && req.status === "pending";
                  const stale = (() => {
                    const d = daysSince(req.updated_at ?? req.created_at);
                    return d !== null && d >= 30;
                  })();
                  const editable = canEditRow(req) && req.status === "pending";
                  const divisionRowBg = req.division === "דלק מוטורס" ? "bg-red-50/60"
                    : req.division === "פריזבי קרסו" ? "bg-green-50/60"
                    : req.division === "לובינסקי" ? "bg-sky-50/60"
                    : "";
                  return (
                      <tr
                        key={req.id}
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${selected.has(req.id) ? "bg-primary/5" : overdueDate ? "bg-red-50/40" : divisionRowBg}`}
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
                        {isVisible("required_to_order") && (
                          <td className={`${cellPadding} tabular-nums font-semibold`}>
                            <InlineEditCell
                              value={req.required_to_order ?? req.quantity ?? null}
                              type="number"
                              disabled={!editable}
                              display={v => (
                                <span className={(v as number) > 0 ? "text-foreground" : "text-muted-foreground"}>
                                  {fmtNum(v as number | null)}
                                </span>
                              )}
                              onCommit={(v) => patchRequest(req.id, { required_to_order: v, quantity: v })}
                            />
                          </td>
                        )}
                        {isVisible("division_stock") && (
                          <td className={`${cellPadding} tabular-nums`}>
                            <InlineEditCell
                              value={req.division_stock}
                              type="number"
                              disabled={!editable}
                              display={v => fmtNum(v as number | null)}
                              onCommit={async (v) => {
                                if (!req.product_id) { toast.error("לא ניתן לעדכן מלאי לשורה ללא מוצר משויך"); return; }
                                const r = await updateDivisionStock(req.division, req.product_id, typeof v === "number" ? v : null);
                                if (!r.ok) { toast.error(r.error ?? "שגיאה בעדכון"); return; }
                                setRequests(prev => prev.map(rr => rr.id === req.id ? ({ ...rr, division_stock: typeof v === "number" ? v : null } as OrderRequest) : rr));
                              }}
                            />
                          </td>
                        )}
                        {isVisible("utilization_pct") && (
                          <td className={`${cellPadding} tabular-nums ${utilizationColor(req.utilization_pct)}`}>
                            <InlineEditCell
                              value={req.utilization_pct}
                              type="number"
                              disabled={!editable}
                              display={v => fmtPct(v as number | null)}
                              onCommit={(v) => patchRequest(req.id, { utilization_pct: v })}
                            />
                          </td>
                        )}
                        {isVisible("urgency") && (
                          <td className={cellPadding}>
                            <InlineSelectCell
                              value={req.urgency}
                              disabled={!editable}
                              options={URGENCY_OPTIONS.map(u => ({ value: u, label: u }))}
                              display={(v) => (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${urgencyClass(v as typeof URGENCY_OPTIONS[number])}`}>
                                  {v ?? "—"}
                                </span>
                              )}
                              onCommit={(v) => patchRequest(req.id, { urgency: v })}
                            />
                          </td>
                        )}
                        {isVisible("order_type") && (
                          <td className={`${cellPadding} text-muted-foreground text-xs`}>
                            <InlineSelectCell
                              value={req.order_type}
                              disabled={!editable}
                              options={ORDER_TYPE_OPTIONS.map(o => ({ value: o, label: o }))}
                              display={(v) => <span>{v ?? "—"}</span>}
                              onCommit={(v) => patchRequest(req.id, { order_type: v })}
                            />
                          </td>
                        )}
                        {isVisible("order_execution_date") && (
                          <td className={`${cellPadding} text-xs whitespace-nowrap ${overdueDate ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            <InlineEditCell
                              value={req.order_execution_date}
                              type="date"
                              disabled={!editable}
                              display={v => v ? format(new Date(String(v)), "dd/MM/yyyy") : "—"}
                              onCommit={(v) => patchRequest(req.id, { order_execution_date: v })}
                            />
                          </td>
                        )}
                        {isVisible("consumption") && (
                          <td className={`${cellPadding} text-muted-foreground tabular-nums`}>
                            <InlineEditCell
                              value={req.current_consumption ?? null}
                              type="number"
                              disabled={!editable}
                              display={v => v ?? "—"}
                              onCommit={(v) => patchRequest(req.id, {
                                current_consumption: v === null ? null : String(v),
                              })}
                            />
                          </td>
                        )}
                        {isVisible("reason") && (
                          <td className={`${cellPadding} text-muted-foreground max-w-[180px]`}>
                            <InlineEditCell
                              value={req.reason}
                              disabled={!editable}
                              display={v => (
                                <span className="block truncate text-right" title={String(v ?? "")}>
                                  {v ?? "—"}
                                </span>
                              )}
                              onCommit={(v) => patchRequest(req.id, { reason: v })}
                            />
                          </td>
                        )}
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
                        {isVisible("delivery_status") && (
                          <td className={cellPadding} onClick={e => e.stopPropagation()}>
                            {canEditDelivery(req) ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity ${
                                    req.delivery_status === "נקלטה" ? "bg-green-50 text-green-700 border-green-200" :
                                    req.delivery_status === "התקבלה" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                    req.delivery_status === "התקבל חלקית" ? "bg-orange-50 text-orange-700 border-orange-200" :
                                    req.delivery_status === "נשלחה" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-muted text-muted-foreground border-border"
                                  }`}>
                                    {req.delivery_status ?? "הגדר סטטוס"}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(["נשלחה", "התקבל חלקית", "התקבלה", "נקלטה"] as const).map(opt => (
                                    <DropdownMenuItem
                                      key={opt}
                                      onClick={() => void updateDeliveryStatus(req.id, opt)}
                                      className={req.delivery_status === opt ? "font-semibold" : ""}
                                    >
                                      {opt}
                                    </DropdownMenuItem>
                                  ))}
                                  {req.delivery_status && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => void updateDeliveryStatus(req.id, null)}
                                        className="text-muted-foreground"
                                      >
                                        נקה סטטוס
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              req.delivery_status ? (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                  req.delivery_status === "נקלטה" ? "bg-green-50 text-green-700 border-green-200" :
                                  req.delivery_status === "התקבלה" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  req.delivery_status === "התקבל חלקית" ? "bg-orange-50 text-orange-700 border-orange-200" :
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  {req.delivery_status}
                                </span>
                              ) : "—"
                            )}
                          </td>
                        )}
                        {isVisible("eta") && (
                          <td className={`${cellPadding} text-muted-foreground text-xs whitespace-nowrap`}>
                            {(() => {
                              const linked = linkedOrdersFor(req);
                              const o = orders.find(x => x.id === (linked[0]?.id ?? null));
                              const eta = o?.tracking_eta ?? o?.eta ?? null;
                              return eta ? format(new Date(eta), "dd/MM/yyyy") : "—";
                            })()}
                          </td>
                        )}
                        {isVisible("ordered_by") && <td className={`${cellPadding} text-muted-foreground text-xs`}>{req.ordered_by_name ?? req.reviewed_by_name ?? "—"}</td>}
                        {isVisible("ordered_at") && (
                          <td className={`${cellPadding} text-muted-foreground text-xs whitespace-nowrap`}>
                            {req.ordered_at ? format(new Date(req.ordered_at), "dd/MM/yyyy") : "—"}
                          </td>
                        )}
                        <td className={cellPadding}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="פעולות"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => setDetailRequest(req)}>
                                פרטים מלאים
                              </DropdownMenuItem>
                              {canEditRow(req) && (
                                <DropdownMenuItem onClick={() => setEditingRequest(req)}>
                                  ערוך
                                </DropdownMenuItem>
                              )}
                              {canCreateRequest && req.division === userDivision && (
                                <DropdownMenuItem onClick={() => setCloneTemplate(req)}>
                                  שכפל
                                </DropdownMenuItem>
                              )}
                              {req.status === "pending" && canFulfill && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setFulfillChooserRequest(req)}>
                                    הזמן
                                  </DropdownMenuItem>
                                </>
                              )}
                              {req.status === "ordered" && (() => {
                                const linked = linkedOrdersFor(req);
                                if (linked.length === 0) return null;
                                return (
                                  <>
                                    <DropdownMenuSeparator />
                                    {linked.map(o => (
                                      <DropdownMenuItem key={o.id} onClick={() => navigateToOrder(o.id)}>
                                        {linked.length === 1 ? "פתח הזמנה" : orderLabel(o)}
                                      </DropdownMenuItem>
                                    ))}
                                  </>
                                );
                              })()}
                              {(req.status === "rejected" || req.status === "cancelled") && canFulfill && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleRevert(req)}>
                                    החזר ל-ממתין
                                  </DropdownMenuItem>
                                </>
                              )}
                              {((req.status === "pending" && canFulfill) || canDeleteRow(req)) && (
                                <>
                                  <DropdownMenuSeparator />
                                  {req.status === "pending" && canFulfill && (
                                    <DropdownMenuItem
                                      onClick={() => setRejectingRequest(req)}
                                      className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                    >
                                      דחה
                                    </DropdownMenuItem>
                                  )}
                                  {canDeleteRow(req) && (
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(req)}
                                      className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                    >
                                      מחק
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                  );
                })}
              </tbody>
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
          allProducts={allProducts}
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
          r.current_consumption && `צריכה חודשית ממוצעת: ${r.current_consumption}`,
          r.required_to_order != null && `כמות: ${r.required_to_order}`,
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
        onFulfill={(r) => { setDetailRequest(null); setFulfillChooserRequest(r); }}
        onReject={(r) => { setDetailRequest(null); setRejectingRequest(r); }}
        onDelete={(r) => { setDetailRequest(null); void handleDelete(r); }}
        onRevert={(r) => { setDetailRequest(null); void handleRevert(r); }}
        onRefresh={fetchRequests}
        getOrderUrl={(id) => `/orders?focus=${id}`}
        navigateToProduct={(id) => { setDetailRequest(null); navigate(`/products/${id}`); }}
        navigateToSupplier={(name) => {
          const s = suppliers.find(s => s.company === name);
          if (s) { setDetailRequest(null); navigate(`/suppliers/${s.id}`); }
        }}
      />

      {/* Fulfillment action chooser (manager only) */}
      <Dialog open={!!fulfillChooserRequest} onOpenChange={(o) => { if (!o) setFulfillChooserRequest(null); }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>איך לטפל בבקשה?</DialogTitle>
          </DialogHeader>
          {fulfillChooserRequest && (
            <div className="space-y-3 pt-2">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="font-semibold">{fulfillChooserRequest.product_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {fulfillChooserRequest.supplier ?? "ללא ספק"} · כמות {fmtNum(fulfillChooserRequest.required_to_order ?? fulfillChooserRequest.quantity)}
                </div>
              </div>
              <button
                onClick={() => {
                  const r = fulfillChooserRequest;
                  setFulfillChooserRequest(null);
                  setFulfillingRequest(r);
                }}
                className="w-full text-right rounded-lg border p-3 hover:bg-accent/40 transition-colors flex items-center gap-3"
              >
                <Plus className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold text-sm">צור הזמנה חדשה</div>
                  <div className="text-xs text-muted-foreground">פתיחת הזמנה חדשה לספק עם הפריט הזה</div>
                </div>
              </button>
              <button
                onClick={() => {
                  const r = fulfillChooserRequest;
                  setFulfillChooserRequest(null);
                  setAttachingRequest(r);
                }}
                className="w-full text-right rounded-lg border p-3 hover:bg-accent/40 transition-colors flex items-center gap-3"
              >
                <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold text-sm">שייך להזמנה קיימת</div>
                  <div className="text-xs text-muted-foreground">הוספת הפריט להזמנה אחת או יותר שכבר פתוחות</div>
                </div>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attach to existing order dialog */}
      <AttachToOrderDialog
        open={!!attachingRequest}
        onOpenChange={(o) => { if (!o) setAttachingRequest(null); }}
        request={attachingRequest}
        onAttached={fetchRequests}
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
