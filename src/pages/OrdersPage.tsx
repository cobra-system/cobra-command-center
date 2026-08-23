import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react";
const ProcurementMeetingTab = lazy(() =>
  import("@/components/meetings/ProcurementMeetingTab")
);
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useData, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { Plus, Search, RefreshCw, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { useProductScope } from "@/hooks/useProductScope";
import { useBackgroundTrackingSync } from "@/hooks/useBackgroundTrackingSync";
import { useTableSelection } from "@/hooks/useTableSelection";
import { OrderBulkActionsBar } from "@/components/orders/OrderBulkActionsBar";
import { TrackingSyncErrorsBanner } from "@/components/orders/TrackingSyncErrorsBanner";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { OrdersDashboardView } from "@/components/orders/OrdersDashboardView";
import { OrderFilters } from "@/components/orders/OrderFilters";
import { OrderTable, type SortField, type SortDir } from "@/components/orders/OrderTable";
import { OrderRequestsTab } from "@/components/orders/OrderRequestsTab";
import { useAuth } from "@/contexts/AppContext";
import { canSeePrices, isDivisionManager } from "@/lib/permissions";
import { isOrderActive, isOrderClosed } from "@/lib/orderStatus";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const allStatuses: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "ממתין" },
  { value: "ORDERED", label: "הוזמן" },
  { value: "SHIPPED", label: "נשלח" },
  { value: "ARRIVED_PORT", label: "הגיע לנמל" },
  { value: "CUSTOMS_CLEARANCE", label: "שחרור מכס" },
  { value: "DELIVERED", label: "נמסר" },
  { value: "ARRIVED", label: "הגיע (ישן)" },
  { value: "CANCELLED", label: "בוטל" },
];

const priorityOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };
const statusOrder: Record<string, number> = { PENDING: 0, ORDERED: 1, SHIPPED: 2, ARRIVED_PORT: 3, CUSTOMS_CLEARANCE: 4, DELIVERED: 5, ARRIVED: 6, CANCELLED: 7 };

export default function OrdersPage() {
  const { updateOrderStatus, updateOrder, addOrder, deleteOrder, suppliers, refreshOrders } = useData();
  const { scopedOrders: orders, scopedProducts: products, scopeOrderItems } = useProductScope();
  const trackingSync = useBackgroundTrackingSync(orders);
  const selection = useTableSelection();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasEdit } = usePermissions("orders");
  const hidePrices = !canSeePrices(currentUser);
  const isDivMgr = isDivisionManager(currentUser);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [defaultProductId, setDefaultProductId] = useState<string | undefined>();
  const [defaultSupplierId, setDefaultSupplierId] = useState<string | undefined>();

  const { data: orderPaymentStatuses = {} } = useQuery({
    queryKey: ["order-payment-statuses"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("order_payments").select("order_id, status");
      if (!data) return {} as Record<string, string>;
      const map: Record<string, { total: number; paid: number }> = {};
      for (const p of data) {
        if (!map[p.order_id]) map[p.order_id] = { total: 0, paid: 0 };
        map[p.order_id].total++;
        if (p.status === "שולם") map[p.order_id].paid++;
      }
      const result: Record<string, string> = {};
      for (const [orderId, counts] of Object.entries(map)) {
        if (counts.paid === 0) result[orderId] = "ממתין";
        else if (counts.paid === counts.total) result[orderId] = "שולם";
        else result[orderId] = "שולם חלקי";
      }
      return result;
    },
  });

  // Honour ?focus=<orderId> by setting the search filter to the order id
  // (table search matches order id) so the user lands on that single row, on the
  // tab that actually holds it — a delivered/cancelled order lives in the archive.
  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus) return;
    // Wait for the orders to load before deciding which tab holds this one.
    if (orders.length === 0) return;
    const target = orders.find(o => o.id === focus);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("focus");
      next.set("q", focus);
      next.set("tab", target && isOrderClosed(target.status) ? "archive" : "table");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams, orders]);

  // Handle create-from-URL params (one-time, not persisted as filter state)
  useEffect(() => {
    const shouldCreate = searchParams.get("create") === "true" || searchParams.get("newOrder") === "true";
    if (shouldCreate) {
      const productId = searchParams.get("product") || searchParams.get("productId") || undefined;
      const supplierId = searchParams.get("supplierId") || undefined;
      if (productId) setDefaultProductId(productId);
      if (supplierId) setDefaultSupplierId(supplierId);
      setShowNewOrderDialog(true);
      // Remove create params but keep filter params
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete("create");
        next.delete("newOrder");
        next.delete("product");
        next.delete("productId");
        next.delete("supplierId");
        return next;
      }, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  // Filters — URL params (shareable/bookmarkable)
  const search = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "all";
  const priorityFilter = searchParams.get("priority") || "all";
  const paymentFilter = searchParams.get("payment") || "all";
  const carrierFilter = searchParams.get("carrier") || "all";
  const trackingStateFilter = searchParams.get("tracking_state") || "all";
  const originFilter = searchParams.get("origin") || "all";

  const setSearch = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v) { n.set("q", v); } else { n.delete("q"); } return n; }, { replace: true }), [setSearchParams]);
  const setStatusFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("status"); } else { n.set("status", v); } return n; }, { replace: true }), [setSearchParams]);
  const setPriorityFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("priority"); } else { n.set("priority", v); } return n; }, { replace: true }), [setSearchParams]);
  const setPaymentFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("payment"); } else { n.set("payment", v); } return n; }, { replace: true }), [setSearchParams]);
  const setCarrierFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("carrier"); } else { n.set("carrier", v); } return n; }, { replace: true }), [setSearchParams]);
  const setTrackingStateFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("tracking_state"); } else { n.set("tracking_state", v); } return n; }, { replace: true }), [setSearchParams]);
  const setOriginFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("origin"); } else { n.set("origin", v); } return n; }, { replace: true }), [setSearchParams]);

  // The open tab is URL state too, so coming back from an order detail (or a
  // shared link) lands on the tab you were on instead of the default dashboard.
  const defaultTab = isDivMgr ? "order-requests" : "dashboard";
  const activeTab = searchParams.get("tab") || defaultTab;
  const setActiveTab = useCallback((v: string) => setSearchParams(prev => {
    const n = new URLSearchParams(prev);
    if (v === defaultTab) { n.delete("tab"); } else { n.set("tab", v); }
    return n;
  }, { replace: true }), [setSearchParams, defaultTab]);

  // Map each order to "local" (Israeli supplier) or "import" (foreign supplier)
  // by resolving the supplier's country. "ישראל" → local, any other country →
  // import; an unresolved/empty country stays null so it only shows under "all".
  const orderOrigin = useCallback((o: (typeof orders)[number]): "local" | "import" | null => {
    let country: string | null | undefined;
    if (o.supplier_id) country = suppliers.find(s => s.id === o.supplier_id)?.country;
    if (country == null && o.supplier_name) country = suppliers.find(s => s.company === o.supplier_name)?.country;
    if (!country) return null;
    return country === "ישראל" ? "local" : "import";
  }, [suppliers]);

  // Sort — localStorage only (personal preference, no need to pollute the URL)
  const [sortField, setSortField] = useState<SortField | null>(() => {
    try { return (JSON.parse(localStorage.getItem("orders:sort") || "null")?.field as SortField) || null; } catch { return null; }
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    try { return (JSON.parse(localStorage.getItem("orders:sort") || "null")?.dir as SortDir) || null; } catch { return null; }
  });

  const saveSort = (field: SortField | null, dir: SortDir) => {
    if (field && dir) { localStorage.setItem("orders:sort", JSON.stringify({ field, dir })); }
    else { localStorage.removeItem("orders:sort"); }
  };

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") { setSortDir("desc"); saveSort(field, "desc"); }
      else { setSortField(null); setSortDir(null); saveSort(null, null); }
    } else {
      setSortField(field); setSortDir("asc"); saveSort(field, "asc");
    }
  }, [sortField, sortDir]);

  const setSort = useCallback((field: SortField, dir: "asc" | "desc") => {
    setSortField(field); setSortDir(dir); saveSort(field, dir);
   
  }, []);

  const archivedOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders
      .filter(o => {
        if (isOrderActive(o.status)) return false;
        if (q) {
          const searchable = [
            o.id,
            scopeOrderItems(o.items).map(i => i.name).join(" "),
            o.supplier_name,
            o.pi_number,
            o.tracking_number,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!searchable.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [orders, search, scopeOrderItems]);

  const filtered = useMemo(() => {
    let result = orders.filter(o => {
      if (isOrderClosed(o.status)) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (priorityFilter !== "all" && o.priority !== priorityFilter) return false;
      if (originFilter !== "all" && orderOrigin(o) !== originFilter) return false;
      if (paymentFilter !== "all" && orderPaymentStatuses[o.id] !== paymentFilter) return false;
      if (carrierFilter !== "all") {
        if (carrierFilter === "none") {
          if (o.tracking_carrier) return false;
        } else if (o.tracking_carrier !== carrierFilter) {
          return false;
        }
      }
      if (trackingStateFilter !== "all") {
        if (trackingStateFilter === "unsynced") {
          if (!(o.tracking_carrier === "dhl" && !o.tracking_status_code)) return false;
        } else if (trackingStateFilter === "error") {
          if (!o.tracking_sync_error) return false;
        } else if (o.tracking_status_code !== trackingStateFilter) {
          return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        // Notes are managerOnly; excluding them from the searchable
        // string avoids leaking note contents via search (value oracle).
        const searchable = [
          o.id,
          scopeOrderItems(o.items).map(i => i.name).join(" "),
          o.supplier_name,
          o.pi_number,
          o.tracking_number,
          o.vessel_name,
          o.booking_number,
          o.contact_name,
          ...(hidePrices ? [] : [o.notes]),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "priority": cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9); break;
          case "product": cmp = (scopeOrderItems(a.items).map(i => i.name).join(", ")).localeCompare(scopeOrderItems(b.items).map(i => i.name).join(", "), "he"); break;
          case "qty": cmp = scopeOrderItems(a.items).reduce((s, i) => s + i.qty, 0) - scopeOrderItems(b.items).reduce((s, i) => s + i.qty, 0); break;
          case "supplier": cmp = (a.supplier_name || "").localeCompare(b.supplier_name || "", "he"); break;
          case "shipping": cmp = (a.shipping || "").localeCompare(b.shipping || "", "he"); break;
          case "status": cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9); break;
          case "order_date": cmp = (a.order_date || "").localeCompare(b.order_date || ""); break;
          case "etd": cmp = (a.etd || "").localeCompare(b.etd || ""); break;
          case "eta": cmp = (a.eta || "").localeCompare(b.eta || ""); break;
          case "total_price": cmp = (a.total_price || 0) - (b.total_price || 0); break;
          case "payment": {
            const order = ["ממתין", "שולם חלקי", "שולם"];
            cmp = (order.indexOf(orderPaymentStatuses[a.id] || "ממתין")) - (order.indexOf(orderPaymentStatuses[b.id] || "ממתין"));
            break;
          }
          case "tracking_number": cmp = (a.tracking_number || "").localeCompare(b.tracking_number || "", "he"); break;
          case "tracking_carrier": cmp = (a.tracking_carrier || "zz").localeCompare(b.tracking_carrier || "zz", "he"); break;
          case "pi_number": cmp = (a.pi_number || "").localeCompare(b.pi_number || "", "he"); break;
          case "updated_at": {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            cmp = dateA - dateB;
            break;
          }
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    } else {
      // Default sort: by ETA ascending (nulls last)
      result = [...result].sort((a, b) => {
        if (!a.eta && !b.eta) return 0;
        if (!a.eta) return 1;
        if (!b.eta) return -1;
        return a.eta.localeCompare(b.eta);
      });
    }

    return result;
  }, [orders, statusFilter, priorityFilter, originFilter, orderOrigin, paymentFilter, carrierFilter, trackingStateFilter, search, sortField, sortDir, orderPaymentStatuses, scopeOrderItems]);

  const orderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      if (isOrderActive(o.status)) {
        counts[o.status] = (counts[o.status] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  // Moving an order to a closed status (נמסר / הגיע / בוטל) drops it out of the
  // active table — say where it went so the row doesn't just vanish.
  const handleStatusChange = useCallback(async (orderId: string, status: OrderStatus) => {
    const wasActive = isOrderActive(orders.find(o => o.id === orderId)?.status);
    await updateOrderStatus(orderId, status);
    if (wasActive && isOrderClosed(status)) {
      toast.info("ההזמנה הועברה לארכיון ההזמנות");
    }
  }, [orders, updateOrderStatus]);

  const navigateToSupplier = (supplierName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const s = suppliers.find(s => s.company === supplierName);
    if (s) navigate(`/suppliers/${s.id}`);
  };

  const navigateToProduct = (productId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(`/products/${productId}`);
  };

  const handleDeleteOrder = async (orderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await deleteOrder(orderId);
    toast.success("ההזמנה נמחקה");
  };

  const handleDuplicateOrder = async (orderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    await addOrder({
      priority: order.priority,
      supplier_id: order.supplier_id || undefined,
      supplier_name: order.supplier_name || undefined,
      shipping: order.shipping || undefined,
      status: "PENDING",
      order_date: new Date().toISOString(),
      etd: order.etd || undefined,
      eta: order.eta || undefined,
      total_price: order.total_price || undefined,
      notes: order.notes || undefined,
      items: order.items.map(i => ({
        name: i.name,
        qty: i.qty,
        price: i.price || undefined,
        product_id: i.product_id || undefined,
      })),
    });
    toast.success("ההזמנה שוכפלה");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">רכש</h1>
        {trackingSync.syncing && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-full px-2.5 py-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            מעדכן מעקב {trackingSync.done}/{trackingSync.total}
          </span>
        )}
        {!isDivMgr && (
          <NewOrderDialog
            suppliers={suppliers}
            products={products}
            addOrder={addOrder}
            open={showNewOrderDialog}
            onOpenChange={setShowNewOrderDialog}
            defaultProductId={defaultProductId}
            defaultSupplierId={defaultSupplierId}
          />
        )}
      </div>

      <TrackingSyncErrorsBanner
        orders={orders}
        onShowFailed={() => setTrackingStateFilter("error")}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 pb-1 flex-1" dir="rtl">
            <TabsList className="w-max min-w-full">
              {!isDivMgr && <TabsTrigger value="dashboard">לוח בקרה</TabsTrigger>}
              {/* Table tab carries the division-manager-specific label for the bonded planning surface. */}
              <TabsTrigger value="table">{isDivMgr ? "רכש מוצרי חטיבה" : "הזמנות פעילות"}</TabsTrigger>
              <TabsTrigger value="archive" className="gap-1.5">
                ארכיון הזמנות
                {archivedOrders.length > 0 && (
                  <span className="bg-muted text-muted-foreground text-xs font-medium px-1.5 py-0.5 rounded-full">
                    {archivedOrders.length}
                  </span>
                )}
              </TabsTrigger>
              {!isDivMgr && <TabsTrigger value="meeting">ישיבת רכש</TabsTrigger>}
              <TabsTrigger value="order-requests">בקשת רכש</TabsTrigger>
            </TabsList>
          </div>
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="חיפוש לפי מוצר או ספק..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9 pl-8"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="נקה חיפוש"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <TabsContent value="dashboard" className="mt-0">
          <OrdersDashboardView orders={orders} orderPaymentStatuses={orderPaymentStatuses} suppliers={suppliers} />
        </TabsContent>

        <TabsContent value="table" className="mt-0 space-y-4">
          <OrderFilters
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            paymentFilter={paymentFilter}
            setPaymentFilter={setPaymentFilter}
            carrierFilter={carrierFilter}
            setCarrierFilter={setCarrierFilter}
            trackingStateFilter={trackingStateFilter}
            setTrackingStateFilter={setTrackingStateFilter}
            originFilter={originFilter}
            setOriginFilter={setOriginFilter}
            orderCounts={orderCounts}
          />
          <OrderTable
            filtered={filtered}
            orderPaymentStatuses={orderPaymentStatuses}
            hasEdit={hasEdit}
            sortField={sortField}
            sortDir={sortDir}
            toggleSort={toggleSort}
            setSort={setSort}
            allStatuses={allStatuses}
            navigateToSupplier={navigateToSupplier}
            navigateToProduct={navigateToProduct}
            handleDeleteOrder={handleDeleteOrder}
            handleDuplicateOrder={handleDuplicateOrder}
            updateOrderStatus={handleStatusChange}
            updateOrder={updateOrder}
            selection={hasEdit ? selection : undefined}
            hidePrices={hidePrices}
          />
          {hasEdit && (
            <OrderBulkActionsBar
              selectedIds={selection.selectedIds}
              onClear={selection.clear}
              onAfterUpdate={refreshOrders}
            />
          )}
        </TabsContent>

        <TabsContent value="archive" className="mt-0 space-y-4">
          <OrderTable
            filtered={archivedOrders}
            orderPaymentStatuses={orderPaymentStatuses}
            hasEdit={hasEdit}
            hidePrices={hidePrices}
            sortField={null}
            sortDir={null}
            toggleSort={() => {}}
            setSort={() => {}}
            allStatuses={allStatuses}
            navigateToSupplier={navigateToSupplier}
            navigateToProduct={navigateToProduct}
            handleDeleteOrder={handleDeleteOrder}
            handleDuplicateOrder={handleDuplicateOrder}
            updateOrderStatus={handleStatusChange}
            updateOrder={updateOrder}
          />
        </TabsContent>

        <TabsContent value="meeting" className="mt-0">
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">טוען...</div>}>
            <ProcurementMeetingTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="order-requests" className="mt-0">
          <OrderRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
