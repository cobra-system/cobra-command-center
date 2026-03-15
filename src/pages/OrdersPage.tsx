import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useData, useAuth, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Plus, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, Zap, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
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

type SortField = "priority" | "product" | "qty" | "supplier" | "shipping" | "status" | "order_date" | "etd" | "eta" | "total_price" | "payment";
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
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orderWorkflows, setOrderWorkflows] = useState<Record<string, WorkflowInfo>>({});
  const isManager = currentUser?.role === "MANAGER";
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [defaultProductId, setDefaultProductId] = useState<string | undefined>();

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

  const [defaultSupplierId, setDefaultSupplierId] = useState<string | undefined>();

  useEffect(() => {
    const shouldCreate = searchParams.get("create") === "true" || searchParams.get("newOrder") === "true";
    if (shouldCreate) {
      const productId = searchParams.get("product") || searchParams.get("productId") || undefined;
      const supplierId = searchParams.get("supplierId") || undefined;
      if (productId) setDefaultProductId(productId);
      if (supplierId) setDefaultSupplierId(supplierId);
      setShowNewOrderDialog(true);
    }
  }, [searchParams]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortField(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filtered = useMemo(() => {
    let result = orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (priorityFilter !== "all" && o.priority !== priorityFilter) return false;
      if (paymentFilter === "paid" && !o.payment_date) return false;
      if (paymentFilter === "unpaid" && o.payment_date) return false;
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
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [orders, statusFilter, priorityFilter, paymentFilter, search, sortField, sortDir]);

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

  const handleWorkflowStepChange = async (orderId: string, wf: WorkflowInfo, newStep: number) => {
    const totalSteps = wf.steps.length;
    const newStatus = newStep >= totalSteps ? "completed" : "active";
    await supabase.from("workflow_instances").update({
      current_step: Math.min(newStep, totalSteps),
      status: newStatus
    }).eq("id", wf.id);
    // Log the step completion if advancing
    if (newStep > wf.current_step) {
      for (let i = wf.current_step; i < newStep && i < totalSteps; i++) {
        await supabase.from("workflow_step_logs").insert({
          instance_id: wf.id,
          step_index: i,
          completed_by: "מנהל",
        });
      }
    } else if (newStep < wf.current_step) {
      // Going back - remove logs
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
      <div className="flex items-center justify-between">
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש לפי מוצר או ספק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <div className="flex bg-secondary rounded-lg p-1">
          {statusFilterOptions.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>{s.label}</button>
          ))}
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="עדיפות" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל העדיפויות</SelectItem>
            {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="תשלום" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל התשלומים</SelectItem>
            <SelectItem value="paid">שולם</SelectItem>
            <SelectItem value="unpaid">לא שולם</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <ThButton field="priority">עדיפות</ThButton>
              <ThButton field="product">מוצר</ThButton>
              <ThButton field="qty">כמות</ThButton>
              <ThButton field="supplier">ספק</ThButton>
              <ThButton field="shipping">משלוח</ThButton>
              <ThButton field="status">סטטוס</ThButton>
              <ThButton field="order_date">תאריך הזמנה</ThButton>
              <ThButton field="etd">ETD</ThButton>
              <ThButton field="eta">ETA</ThButton>
              <ThButton field="total_price">סה״כ</ThButton>
              <ThButton field="payment">תשלום</ThButton>
              <th className="text-right p-3 font-semibold text-foreground">תהליך</th>
              {isManager && <th className="text-right p-3 font-semibold text-foreground w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={isManager ? 13 : 12} className="p-8 text-center text-muted-foreground">אין הזמנות</td></tr>
            ) : filtered.map(order => (
              <tr key={order.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/orders/${order.id}`)}>
                <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                <td className="p-3 font-medium text-foreground max-w-[200px] truncate" onClick={e => e.stopPropagation()}>
                  {order.items.map((i, idx) => (
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
                <td className="p-3 text-muted-foreground">{order.items.reduce((s, i) => s + i.qty, 0)}</td>
                <td className="p-3">
                  {order.supplier_name ? (
                    <button onClick={(e) => navigateToSupplier(order.supplier_name!, e)} className="text-primary hover:underline text-sm">
                      {order.supplier_name}
                    </button>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-muted-foreground">{order.shipping || "—"}</td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
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
                <td className="p-3 text-muted-foreground text-xs">{order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-3 text-muted-foreground text-xs">{order.etd ? new Date(order.etd).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-3 text-muted-foreground text-xs">{order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-3 text-muted-foreground text-xs">{order.total_price ? `$${order.total_price.toLocaleString()}` : "—"}</td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="cursor-pointer">
                        {order.payment_date ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">שולם</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">ממתין</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="start">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => updateOrder(order.id, { payment_date: new Date().toISOString() })}
                          className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", order.payment_date && "bg-muted")}
                        >
                          שולם ✓
                        </button>
                        <button
                          onClick={() => updateOrder(order.id, { payment_date: null })}
                          className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", !order.payment_date && "bg-muted")}
                        >
                          ממתין
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
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
                    <span className="text-xs text-muted-foreground">אוטומטי</span>
                  )}
                </td>
                {isManager && (
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
    </div>
  );
}
