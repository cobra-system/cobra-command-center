import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useData, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Plus, Trash2, Copy, Search, ArrowUpDown, ArrowUp, ArrowDown, Zap, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { OrdersDashboardView } from "@/components/orders/OrdersDashboardView";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const allStatuses: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "ממתין" },
  { value: "ORDERED", label: "הוזמן" },
  { value: "SHIPPED", label: "נשלח" },
  { value: "ARRIVED", label: "הגיע" },
  { value: "CANCELLED", label: "בוטל" },
];

const priorities: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

const priorityOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };
const statusOrder: Record<string, number> = { PENDING: 0, ORDERED: 1, SHIPPED: 2, ARRIVED: 3, CANCELLED: 4 };

type SortField = "priority" | "product" | "qty" | "supplier" | "shipping" | "status" | "order_date" | "etd" | "eta" | "total_price" | "payment" | "workflow" | "tracking_number";
type SortDir = "asc" | "desc" | null;

const statusFilterOptions = [
  { value: "all", label: "הכל" },
  ...allStatuses.filter(s => s.value !== "CANCELLED"),
];

interface WorkflowInfo {
  id: string;
  status: string;
  current_step: number;
  steps: { name: string }[];
}

export default function OrdersPage() {
  const { orders, updateOrderStatus, updateOrder, addOrder, deleteOrder, suppliers, products } = useData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orderWorkflows, setOrderWorkflows] = useState<Record<string, WorkflowInfo>>({});
  const { hasEdit } = usePermissions("orders");
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [defaultProductId, setDefaultProductId] = useState<string | undefined>();
  const [defaultSupplierId, setDefaultSupplierId] = useState<string | undefined>();

  useEffect(() => {
    const fetchWorkflows = async () => {
      const { data } = await supabase
        .from("workflow_instances")
        .select("id, order_id, status, current_step, template_id")
        .not("order_id", "is", null);
      if (data) {
        const templateIds = [...new Set(data.map(w => w.template_id).filter(Boolean))];
        let templates: Record<string, any[]> = {};
        if (templateIds.length > 0) {
          const { data: tpls } = await supabase.from("workflow_templates").select("id, steps").in("id", templateIds);
          if (tpls) tpls.forEach(t => { templates[t.id] = (t.steps as any[]) || []; });
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
  }, []); // only on mount

  // Read filter/sort state from URL params
  const search = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "all";
  const priorityFilter = searchParams.get("priority") || "all";
  const paymentFilter = searchParams.get("payment") || "all";
  const workflowFilter = searchParams.get("wf") || "all";
  const sortField = (searchParams.get("sort") as SortField | null) || null;
  const sortDir = (searchParams.get("dir") as SortDir) || null;

  // Setters that update URL params
  const setSearch = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); v ? n.set("q", v) : n.delete("q"); return n; }, { replace: true }), [setSearchParams]);
  const setStatusFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); v === "all" ? n.delete("status") : n.set("status", v); return n; }, { replace: true }), [setSearchParams]);
  const setPriorityFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); v === "all" ? n.delete("priority") : n.set("priority", v); return n; }, { replace: true }), [setSearchParams]);
  const setPaymentFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); v === "all" ? n.delete("payment") : n.set("payment", v); return n; }, { replace: true }), [setSearchParams]);
  const setWorkflowFilter = useCallback((v: string) => setSearchParams(prev => { const n = new URLSearchParams(prev); v === "all" ? n.delete("wf") : n.set("wf", v); return n; }, { replace: true }), [setSearchParams]);

  const toggleSort = useCallback((field: SortField) => {
    setSearchParams(prev => {
      const n = new URLSearchParams(prev);
      const currentField = prev.get("sort");
      const currentDir = prev.get("dir");
      if (currentField === field) {
        if (currentDir === "asc") { n.set("dir", "desc"); }
        else { n.delete("sort"); n.delete("dir"); }
      } else {
        n.set("sort", field);
        n.set("dir", "asc");
      }
      return n;
    }, { replace: true });
  }, [setSearchParams]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filtered = useMemo(() => {
    let result = orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (priorityFilter !== "all" && o.priority !== priorityFilter) return false;
      if (paymentFilter !== "all" && (o as any).payment_status !== paymentFilter) return false;
      if (workflowFilter !== "all") {
        const wf = orderWorkflows[o.id];
        if (workflowFilter === "active" && (!wf || wf.status !== "active")) return false;
        if (workflowFilter === "completed" && (!wf || wf.status !== "completed")) return false;
        if (workflowFilter === "none" && wf) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const itemNames = o.items.map(i => i.name).join(" ").toLowerCase();
        const supplier = (o.supplier_name || "").toLowerCase();
        if (!itemNames.includes(q) && !supplier.includes(q)) return false;
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

  const navigateToSupplier = (supplierName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const s = suppliers.find(s => s.company === supplierName);
    if (s) navigate(`/suppliers/${s.id}`);
  };

  const navigateToProduct = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/products/${productId}`);
  };

  const handleDeleteOrder = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteOrder(orderId);
    toast.success("ההזמנה נמחקה");
  };

  const handleDuplicateOrder = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const ThButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th className="text-right p-3 font-semibold text-foreground">
      <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-primary transition-colors">
        {children}
        <SortIcon field={field} />
      </button>
    </th>
  );

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
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <OrdersDashboardView orders={filtered} orderWorkflows={orderWorkflows} suppliers={suppliers} />
        </TabsContent>

        <TabsContent value="table" className="mt-0 space-y-4">

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
        <div className="relative flex-1 min-w-[150px] max-w-sm order-first w-full sm:w-auto sm:order-none">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש לפי מוצר או ספק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <div className="flex bg-secondary rounded-lg p-1 overflow-x-auto">
          {statusFilterOptions.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              statusFilter === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>{s.label}</button>
          ))}
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[110px] sm:w-[130px]"><SelectValue placeholder="עדיפות" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל העדיפויות</SelectItem>
            {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[100px] sm:w-[120px]"><SelectValue placeholder="תשלום" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל התשלומים</SelectItem>
            <SelectItem value="שולם">שולם</SelectItem>
            <SelectItem value="שולם פיקדון">שולם פיקדון</SelectItem>
            <SelectItem value="ממתין">ממתין</SelectItem>
          </SelectContent>
        </Select>
        <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
          <SelectTrigger className="w-[110px] sm:w-[130px]"><SelectValue placeholder="תהליך" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל התהליכים</SelectItem>
            <SelectItem value="active">תהליך פעיל</SelectItem>
            <SelectItem value="completed">תהליך הושלם</SelectItem>
            <SelectItem value="none">ללא תהליך</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto" dir="rtl">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <ThButton field="priority">עדיפות</ThButton>
              <ThButton field="product">מוצר</ThButton>
              <ThButton field="qty">כמות</ThButton>
              <ThButton field="supplier">ספק</ThButton>
              <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden md:table-cell">
                <button onClick={() => toggleSort("shipping")} className="flex items-center gap-1 hover:text-primary transition-colors">
                  משלוח<SortIcon field="shipping" />
                </button>
              </th>
              <ThButton field="status">סטטוס</ThButton>
              <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden md:table-cell">
                <button onClick={() => toggleSort("order_date")} className="flex items-center gap-1 hover:text-primary transition-colors">
                  תאריך הזמנה<SortIcon field="order_date" />
                </button>
              </th>
              <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
                <button onClick={() => toggleSort("etd")} className="flex items-center gap-1 hover:text-primary transition-colors">
                  ETD<SortIcon field="etd" />
                </button>
              </th>
              <ThButton field="eta">ETA</ThButton>
              <ThButton field="total_price">סה״כ</ThButton>
              <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
                <button onClick={() => toggleSort("payment")} className="flex items-center gap-1 hover:text-primary transition-colors">
                  תשלום<SortIcon field="payment" />
                </button>
              </th>
              <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
                <button onClick={() => toggleSort("workflow")} className="flex items-center gap-1 hover:text-primary transition-colors">
                  תהליך<SortIcon field="workflow" />
                </button>
              </th>
              <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
                <button onClick={() => toggleSort("tracking_number")} className="flex items-center gap-1 hover:text-primary transition-colors">
                  מספר מעקב<SortIcon field="tracking_number" />
                </button>
              </th>
              <th className="text-right p-2 sm:p-3 font-semibold text-foreground w-10"></th>
              {hasEdit && <th className="text-right p-2 sm:p-3 font-semibold text-foreground w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={hasEdit ? 15 : 14} className="p-8 text-center text-muted-foreground">אין הזמנות</td></tr>
            ) : filtered.map((order) => (
              <tr key={order.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={(e) => { if (e.detail !== 1) return; navigate(`/orders/${order.id}`); }} data-navigate-to={`/orders/${order.id}`}>
                <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                <td className="p-3 font-medium text-foreground max-w-[200px] truncate" onClick={e => e.stopPropagation()}>
                  {order.items.length === 0 ? (
                    <span className="text-muted-foreground italic text-xs">ללא פריטים</span>
                  ) : order.items.map((i, idx) => (
                    <span key={idx}>
                      {i.product_id ? (
                        <button onClick={(e) => navigateToProduct(i.product_id!, e)} className="text-primary hover:underline text-sm">
                          {i.name}
                        </button>
                      ) : (
                        <span>{i.name}</span>
                      )}
                      {idx < order.items.length - 1 && <span>, </span>}
                    </span>
                  ))}
                </td>
                <td className="p-3 text-muted-foreground">{order.items.reduce((s, i) => s + i.qty, 0) || "—"}</td>
                <td className="p-3">
                  {order.supplier_name ? (
                    <button onClick={(e) => navigateToSupplier(order.supplier_name!, e)} className="text-primary hover:underline text-sm">
                      {order.supplier_name}
                    </button>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-2 sm:p-3 text-muted-foreground hidden md:table-cell">{order.shipping || "—"}</td>
                <td className="p-2 sm:p-3" onClick={e => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="cursor-pointer"><OrderStatusBadge status={order.status as OrderStatus} /></button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="start">
                      <div className="flex flex-col gap-0.5">
                        {allStatuses.map(s => (
                          <button
                            key={s.value}
                            onClick={() => updateOrderStatus(order.id, s.value)}
                            className={cn(
                              "px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted",
                              order.status === s.value && "bg-muted"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="p-2 sm:p-3 text-muted-foreground text-xs hidden md:table-cell">{order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-2 sm:p-3 text-muted-foreground text-xs hidden lg:table-cell">{order.etd ? new Date(order.etd).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-2 sm:p-3 text-muted-foreground text-xs">{order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-2 sm:p-3 text-muted-foreground text-xs">{order.total_price ? `$${order.total_price.toLocaleString()}` : "—"}</td>
                <td className="p-2 sm:p-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="cursor-pointer">
                        {(() => {
                          const ps = (order as any).payment_status || "ממתין";
                          const colors: Record<string, string> = {
                            "שולם": "bg-success/15 text-success",
                            "שולם פיקדון": "bg-accent/15 text-accent",
                            "ממתין": "bg-warning/15 text-warning",
                          };
                          return <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", colors[ps] || "bg-muted text-muted-foreground")}>{ps}</span>;
                        })()}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="start">
                      <div className="flex flex-col gap-0.5">
                        {["ממתין", "שולם פיקדון", "שולם"].map(ps => (
                          <button
                            key={ps}
                            onClick={() => updateOrder(order.id, {
                              payment_status: ps,
                              payment_date: ps === "שולם" ? new Date().toISOString() : ps === "שולם פיקדון" ? new Date().toISOString() : null,
                            } as any)}
                            className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", (order as any).payment_status === ps && "bg-muted")}
                          >
                            {ps === "שולם" ? "שולם ✓" : ps}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="p-2 sm:p-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                  {orderWorkflows[order.id] ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer",
                          orderWorkflows[order.id].status === "completed"
                            ? "bg-success/15 text-success"
                            : orderWorkflows[order.id].status === "cancelled"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/15 text-primary"
                        )}>
                          {orderWorkflows[order.id].status === "completed" ? (
                            <><CheckCircle className="h-3 w-3" />הושלם</>
                          ) : orderWorkflows[order.id].status === "cancelled" ? (
                            <>בוטל</>
                          ) : (
                            <><Zap className="h-3 w-3" />שלב {orderWorkflows[order.id].current_step + 1}</>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1" align="start">
                        <div className="flex flex-col gap-0.5">
                          {orderWorkflows[order.id].steps.map((step: any, idx: number) => {
                            const wf = orderWorkflows[order.id];
                            const isCompleted = idx < wf.current_step || wf.status === "completed";
                            const isCurrent = idx === wf.current_step && wf.status === "active";
                            return (
                              <button
                                key={idx}
                                onClick={() => handleWorkflowStepChange(order.id, wf, idx)}
                                className={cn(
                                  "px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted flex items-center gap-2",
                                  isCurrent && "bg-primary/10"
                                )}
                              >
                                <span className={cn(
                                  "w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0",
                                  isCompleted ? "bg-success text-success-foreground" :
                                  isCurrent ? "bg-primary text-primary-foreground" :
                                  "bg-muted text-muted-foreground"
                                )}>
                                  {isCompleted ? "✓" : idx + 1}
                                </span>
                                {step.name}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => handleWorkflowStepChange(order.id, orderWorkflows[order.id], orderWorkflows[order.id].steps.length)}
                            className={cn(
                              "px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted flex items-center gap-2 border-t mt-1 pt-2",
                              orderWorkflows[order.id].status === "completed" && "bg-success/10"
                            )}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-success" />
                            סיים תהליך
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-2 sm:p-3 text-muted-foreground text-xs hidden lg:table-cell">{order.tracking_number || "—"}</td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <button
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title="שכפל הזמנה"
                    onClick={(e) => handleDuplicateOrder(order.id, e)}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </td>
                {hasEdit && (
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1 rounded hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>מחיקת הזמנה</AlertDialogTitle>
                          <AlertDialogDescription>האם למחוק את ההזמנה? פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction onClick={(e) => handleDeleteOrder(order.id, e)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

        </TabsContent>
      </Tabs>
    </div>
  );
}
