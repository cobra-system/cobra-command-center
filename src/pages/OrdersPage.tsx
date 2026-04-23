import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react";
const ProcurementMeetingTab = lazy(() =>
  import("@/components/meetings/ProcurementMeetingTab")
);
const ShipmentGroupsTab = lazy(() =>
  import("@/components/orders/ShipmentGroupsTab").then(m => ({ default: m.ShipmentGroupsTab }))
);
import { useNavigate, useSearchParams } from "react-router-dom";
import { useData, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { useProductScope } from "@/hooks/useProductScope";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { OrdersDashboardView } from "@/components/orders/OrdersDashboardView";
import { OrderFilters } from "@/components/orders/OrderFilters";
import { OrderTable, type SortField, type SortDir, type WorkflowInfo } from "@/components/orders/OrderTable";
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
  const { updateOrderStatus, updateOrder, addOrder, deleteOrder, suppliers } = useData();
  const { scopedOrders: orders, scopedProducts: products } = useProductScope();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orderWorkflows, setOrderWorkflows] = useState<Record<string, WorkflowInfo>>({});
  const { hasEdit } = usePermissions("orders");
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [defaultProductId, setDefaultProductId] = useState<string | undefined>();
  const [defaultSupplierId, setDefaultSupplierId] = useState<string | undefined>();
  const [archiveSearch, setArchiveSearch] = useState("");

  useEffect(() => {
    const fetchWorkflows = async () => {
      const { data } = await supabase
        .from("workflow_instances")
        .select("id, order_id, status, current_step, template_id")
        .not("order_id", "is", null);
      if (data) {
        const templateIds = [...new Set(data.map(w => w.template_id).filter(Boolean))];
        const templates: Record<string, { name: string }[]> = {};
        if (templateIds.length > 0) {
          const { data: tpls } = await supabase.from("workflow_templates").select("id, steps").in("id", templateIds);
          if (tpls) tpls.forEach(t => { templates[t.id] = (t.steps as { name: string }[]) || []; });
        }
        const map: Record<string, WorkflowInfo> = {};
        data.forEach(w => {
          if (w.order_id) {
            map[w.order_id] = {
              id: w.id,
              status: w.status,
              current_step: w.current_step,
              steps: templates[w.template_id!] || []
            };
          }
        });
        setOrderWorkflows(map);
      }
    };
    fetchWorkflows();
  }, [orders]);

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
  const workflowFilter = searchParams.get("wf") || "all";

  const setSearch = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v) { n.set("q", v); } else { n.delete("q"); } return n; }, { replace: true }), [setSearchParams]);
  const setStatusFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("status"); } else { n.set("status", v); } return n; }, { replace: true }), [setSearchParams]);
  const setPriorityFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("priority"); } else { n.set("priority", v); } return n; }, { replace: true }), [setSearchParams]);
  const setPaymentFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("payment"); } else { n.set("payment", v); } return n; }, { replace: true }), [setSearchParams]);
  const setWorkflowFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === "all") { n.delete("wf"); } else { n.set("wf", v); } return n; }, { replace: true }), [setSearchParams]);

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
    const q = archiveSearch.toLowerCase();
    return orders
      .filter(o => {
        if (o.status !== "ARRIVED" && o.status !== "CANCELLED") return false;
        if (q) {
          const itemNames = o.items.map(i => i.name).join(" ").toLowerCase();
          const supplier = (o.supplier_name || "").toLowerCase();
          if (!itemNames.includes(q) && !supplier.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [orders, archiveSearch]);

  const filtered = useMemo(() => {
    let result = orders.filter(o => {
      if (o.status === "ARRIVED" || o.status === "CANCELLED") return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (priorityFilter !== "all" && o.priority !== priorityFilter) return false;
      if (paymentFilter !== "all" && (o as Record<string, unknown>).payment_status !== paymentFilter) return false;
      {
        const wf = orderWorkflows[o.id];
        if (workflowFilter === "all") {
          // By default, hide completed workflow orders (archive)
          if (wf && wf.status === "completed") return false;
        } else if (workflowFilter === "active" && (!wf || wf.status !== "active")) return false;
        else if (workflowFilter === "completed" && (!wf || wf.status !== "completed")) return false;
        else if (workflowFilter === "none" && wf) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const searchable = [
          o.items.map(i => i.name).join(" "),
          o.supplier_name,
          o.pi_number,
          o.tracking_number,
          o.vessel_name,
          o.booking_number,
          o.contact_name,
          o.notes,
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
          case "product": cmp = (a.items.map(i => i.name).join(", ")).localeCompare(b.items.map(i => i.name).join(", "), "he"); break;
          case "qty": cmp = a.items.reduce((s, i) => s + i.qty, 0) - b.items.reduce((s, i) => s + i.qty, 0); break;
          case "supplier": cmp = (a.supplier_name || "").localeCompare(b.supplier_name || "", "he"); break;
          case "shipping": cmp = (a.shipping || "").localeCompare(b.shipping || "", "he"); break;
          case "status": cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9); break;
          case "order_date": cmp = (a.order_date || "").localeCompare(b.order_date || ""); break;
          case "etd": cmp = (a.etd || "").localeCompare(b.etd || ""); break;
          case "eta": cmp = (a.eta || "").localeCompare(b.eta || ""); break;
          case "total_price": cmp = (a.total_price || 0) - (b.total_price || 0); break;
          case "payment": cmp = (a.payment_date || "").localeCompare(b.payment_date || ""); break;
          case "tracking_number": cmp = (a.tracking_number || "").localeCompare(b.tracking_number || "", "he"); break;
          case "pi_number": cmp = (a.pi_number || "").localeCompare(b.pi_number || "", "he"); break;
          case "updated_at": {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            cmp = dateA - dateB;
            break;
          }
          case "workflow": {
            const stepA = orderWorkflows[a.id] ? (orderWorkflows[a.id].status === "completed" ? 999 : orderWorkflows[a.id].current_step) : -1;
            const stepB = orderWorkflows[b.id] ? (orderWorkflows[b.id].status === "completed" ? 999 : orderWorkflows[b.id].current_step) : -1;
            cmp = stepA - stepB;
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
  }, [orders, statusFilter, priorityFilter, paymentFilter, workflowFilter, search, sortField, sortDir, orderWorkflows]);

  const orderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      if (o.status !== "ARRIVED" && o.status !== "CANCELLED") {
        counts[o.status] = (counts[o.status] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

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

  const handleWorkflowStepChange = async (orderId: string, wf: WorkflowInfo, newStep: number) => {
    const totalSteps = wf.steps.length;
    const newStatus = newStep >= totalSteps ? "completed" : "active";
    const { error: updErr } = await supabase.from("workflow_instances").update({
      current_step: Math.min(newStep, totalSteps),
      status: newStatus
    }).eq("id", wf.id);
    if (updErr) { toast.error("שגיאה בעדכון שלב: " + updErr.message); return; }
    if (newStep > wf.current_step) {
      for (let i = wf.current_step; i < newStep && i < totalSteps; i++) {
        await supabase.from("workflow_step_logs").insert({
          instance_id: wf.id,
          step_index: i,
          completed_by: "מנהל",
        });
      }
    } else if (newStep < wf.current_step) {
      await supabase.from("workflow_step_logs").delete().eq("instance_id", wf.id).gte("step_index", newStep);
    }
    setOrderWorkflows(prev => ({
      ...prev,
      [orderId]: { ...wf, current_step: Math.min(newStep, totalSteps), status: newStatus }
    }));
    toast.success(newStatus === "completed" ? "תהליך הושלם" : `שלב ${newStep + 1}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">הזמנות</h1>
        <NewOrderDialog
          suppliers={suppliers}
          products={products}
          addOrder={addOrder}
          open={showNewOrderDialog}
          onOpenChange={setShowNewOrderDialog}
          defaultProductId={defaultProductId}
          defaultSupplierId={defaultSupplierId}
        />
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">לוח בקרה</TabsTrigger>
          <TabsTrigger value="table">טבלת הזמנות</TabsTrigger>
          <TabsTrigger value="archive" className="gap-1.5" dir="ltr">
            ארכיון הזמנות
            {archivedOrders.length > 0 && (
              <span className="bg-muted text-muted-foreground text-xs font-medium px-1.5 py-0.5 rounded-full">
                {archivedOrders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="agenda">סדר יום רכש</TabsTrigger>
          <TabsTrigger value="shipment-groups">קבוצות משלוח</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <OrdersDashboardView orders={orders} orderWorkflows={orderWorkflows} suppliers={suppliers} />
        </TabsContent>

        <TabsContent value="table" className="mt-0 space-y-4">
          <OrderFilters
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            paymentFilter={paymentFilter}
            setPaymentFilter={setPaymentFilter}
            workflowFilter={workflowFilter}
            setWorkflowFilter={setWorkflowFilter}
            orderCounts={orderCounts}
          />
          <OrderTable
            filtered={filtered}
            orderWorkflows={orderWorkflows}
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
            handleWorkflowStepChange={handleWorkflowStepChange}
            updateOrderStatus={updateOrderStatus}
            updateOrder={updateOrder}
          />
        </TabsContent>

        <TabsContent value="archive" className="mt-0 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי מוצר או ספק..."
              value={archiveSearch}
              onChange={e => setArchiveSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <OrderTable
            filtered={archivedOrders}
            orderWorkflows={orderWorkflows}
            hasEdit={hasEdit}
            sortField={null}
            sortDir={null}
            toggleSort={() => {}}
            setSort={() => {}}
            allStatuses={allStatuses}
            navigateToSupplier={navigateToSupplier}
            navigateToProduct={navigateToProduct}
            handleDeleteOrder={handleDeleteOrder}
            handleDuplicateOrder={handleDuplicateOrder}
            handleWorkflowStepChange={handleWorkflowStepChange}
            updateOrderStatus={updateOrderStatus}
            updateOrder={updateOrder}
          />
        </TabsContent>

        <TabsContent value="agenda" className="mt-0">
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">טוען...</div>}>
            <ProcurementMeetingTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="shipment-groups" className="mt-0">
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">טוען...</div>}>
            <ShipmentGroupsTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
