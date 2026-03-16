import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useData, useAuth, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { ArrowRight, Package, Truck, Calendar, DollarSign, FileText, Trash2, CreditCard, Zap, Check, Ship, Hash, Plus, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import DocumentsSection from "@/components/DocumentsSection";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineEditField } from "@/components/InlineEditField";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

const shippingOptions = [
  { value: "ים", label: "ים" },
  { value: "אוויר", label: "אוויר" },
  { value: "יבשה", label: "יבשה" },
  { value: "אקספרס", label: "אקספרס" },
];

const statusOptions = allStatuses.map(s => ({ value: s.value, label: s.label }));
const priorityOptions = priorities.map(p => ({ value: p.value, label: p.label }));

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { orders, updateOrderStatus, updateOrder, deleteOrder, suppliers, products, refreshOrders, updateProduct, updateComponent } = useData();

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editItemDialog, setEditItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemProductId, setItemProductId] = useState("");
  const [itemComponentId, setItemComponentId] = useState("");

  const order = orders.find(o => o.id === id);
  const supplier = order?.supplier_id ? suppliers.find(s => s.id === order.supplier_id) : null;
  const isManager = currentUser?.role === "MANAGER";

  const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.company })), [suppliers]);

  if (!order) return <div className="p-8 text-center text-muted-foreground">הזמנה לא נמצאה</div>;

  const handleDelete = async () => {
    await deleteOrder(order.id);
    toast.success("ההזמנה נמחקה");
    navigate("/orders");
  };

  const handleInlineSave = async (field: string, value: string) => {
    const updates: Record<string, any> = {};
    if (field === "total_price") {
      updates[field] = value ? Number(value) : null;
    } else if (field === "status") {
      await updateOrderStatus(order.id, value as OrderStatus);
      return;
    } else if (field === "priority") {
      updates[field] = value;
    } else if (field === "supplier_id") {
      updates.supplier_id = value || null;
      const s = suppliers.find(s => s.id === value);
      updates.supplier_name = s?.company || null;
    } else {
      updates[field] = value || null;
    }
    await updateOrder(order.id, updates as any);
    toast.success("עודכן");
  };

  const handleDateSave = async (field: string, date: Date | undefined) => {
    await updateOrder(order.id, { [field]: date ? date.toISOString() : null } as any);
    toast.success("עודכן");
  };

  // Payment status cycle via double-click: ממתין → שולם פיקדון → שולם → ממתין
  const paymentStatuses = ["ממתין", "שולם פיקדון", "שולם"] as const;
  const cyclePaymentStatus = async () => {
    if (!isManager) return;
    const current = (order as any).payment_status || "ממתין";
    const idx = paymentStatuses.indexOf(current);
    const next = paymentStatuses[(idx + 1) % paymentStatuses.length];
    await updateOrder(order.id, {
      payment_status: next,
      payment_date: next === "שולם" || next === "שולם פיקדון" ? new Date().toISOString() : null,
    } as any);
  };

  // Item CRUD
  const openAddItem = () => {
    setEditingItem(null);
    setItemName("");
    setItemQty("1");
    setItemPrice("");
    setItemProductId("");
    setItemComponentId("");
    setEditItemDialog(true);
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemQty(item.qty?.toString() || "1");
    setItemPrice(item.price?.toString() || "");
    setItemProductId(item.product_id || "");
    setEditItemDialog(true);
  };

  const handleSaveItem = async () => {
    let name = itemName;
    const linkedProduct = itemProductId ? products.find(p => p.id === itemProductId) : null;
    const linkedComponent = itemComponentId && linkedProduct
      ? linkedProduct.components?.find(c => c.id === itemComponentId)
      : null;

    if (linkedComponent) {
      name = `${linkedComponent.name} (${linkedProduct?.name})`;
    } else if (linkedProduct) {
      name = linkedProduct.name;
    }
    if (!name.trim()) return;

    const enteredPrice = itemPrice ? Number(itemPrice) : null;

    if (editingItem) {
      const { error } = await supabase.from("order_items").update({
        name: name.trim(),
        qty: Number(itemQty) || 1,
        price: enteredPrice,
        product_id: itemProductId || null,
      }).eq("id", editingItem.id);
      if (error) { toast.error("שגיאה בעדכון פריט"); return; }
      toast.success("פריט עודכן");
    } else {
      const { error } = await supabase.from("order_items").insert({
        order_id: order.id,
        name: name.trim(),
        qty: Number(itemQty) || 1,
        price: enteredPrice,
        product_id: itemProductId || null,
      });
      if (error) { toast.error("שגיאה בהוספת פריט"); return; }
      toast.success("פריט נוסף");
    }
    setEditItemDialog(false);
    await refreshOrders();

    // Suggest updating the source price if it differs
    if (enteredPrice !== null && enteredPrice > 0) {
      if (linkedComponent && enteredPrice !== linkedComponent.price) {
        const compName = linkedComponent.name;
        toast.info(`מחיר הרכיב "${compName}" לא מוגדר או שונה. תרצה לעדכן ל-$${enteredPrice}?`, {
          action: {
            label: "עדכן",
            onClick: async () => {
              await updateComponent(linkedComponent.id, { price: enteredPrice });
              toast.success(`מחיר הרכיב "${compName}" עודכן ל-$${enteredPrice}`);
            },
          },
          duration: 10000,
        });
      } else if (linkedProduct && !linkedComponent && enteredPrice !== linkedProduct.purchase_price) {
        const prodName = linkedProduct.name;
        toast.info(`מחיר הרכישה של "${prodName}" לא מוגדר או שונה. תרצה לעדכן ל-$${enteredPrice}?`, {
          action: {
            label: "עדכן",
            onClick: async () => {
              await updateProduct(linkedProduct.id, { purchase_price: enteredPrice });
              toast.success(`מחיר הרכישה של "${prodName}" עודכן ל-$${enteredPrice}`);
            },
          },
          duration: 10000,
        });
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from("order_items").delete().eq("id", itemId);
    if (error) { toast.error("שגיאה במחיקת פריט"); return; }
    toast.success("פריט נמחק");
    await refreshOrders();
  };

  const details: { label: string; field: string; value: string | number | null | undefined; options?: { value: string; label: string }[]; isDate?: boolean; isSupplierLink?: boolean; icon?: any; isReadOnly?: boolean }[] = [
    { label: "סטטוס", field: "status", value: order.status, options: statusOptions, icon: Check },
    { label: "עדיפות", field: "priority", value: order.priority, options: priorityOptions, icon: Hash },
    { label: "ספק", field: "supplier_id", value: order.supplier_id, options: supplierOptions, isSupplierLink: true, icon: Truck },
    { label: "סה״כ ($)", field: "total_price", value: order.total_price?.toString() ?? "", icon: DollarSign, isReadOnly: true },
    { label: "שיטת משלוח", field: "shipping", value: order.shipping, options: shippingOptions, icon: Ship },
    { label: "הערות", field: "notes", value: order.notes, icon: FileText },
  ];

  const dateFields = [
    { label: "תאריך הזמנה", field: "order_date", value: order.order_date, icon: Calendar },
    { label: "ETD (יציאה)", field: "etd", value: order.etd, icon: Calendar },
    { label: "ETA (הגעה)", field: "eta", value: order.eta, icon: Calendar },
    { label: "תאריך תשלום", field: "payment_date", value: order.payment_date, icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">תיק הזמנה</h1>
          <p className="text-sm text-muted-foreground">
            {order.items.map((i, idx) => {
              const linkedProduct = i.product_id ? products.find(p => p.id === i.product_id) : products.find(p => p.name === i.name);
              return (
                <span key={idx}>
                  {linkedProduct ? (
                    <button onClick={(e) => { e.preventDefault(); navigate(`/products/${linkedProduct.id}`); }} className="text-primary hover:underline cursor-pointer">{i.name}</button>
                  ) : i.name}
                  {idx < order.items.length - 1 && <span>, </span>}
                </span>
              );
            })}
          </p>
        </div>
        {isManager && (
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4 ml-1" />מחיקה
          </Button>
        )}
        <PriorityBadge priority={order.priority as Priority} />
      </div>

      {/* Details Grid */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">פרטי הזמנה</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {details.map(d => {
            const supplierMatch = d.isSupplierLink && d.value ? suppliers.find(s => s.id === d.value) : null;
            if (d.field === "status") {
              return (
                <InlineEditField key={d.label} label={d.label} value={d.value as string}
                  displayValue={<OrderStatusBadge status={order.status as OrderStatus} />}
                  onSave={(v) => handleInlineSave(d.field, v)} disabled={!isManager} options={d.options} />
              );
            }
            if (d.field === "priority") {
              return (
                <InlineEditField key={d.label} label={d.label} value={d.value as string}
                  displayValue={<PriorityBadge priority={order.priority as Priority} />}
                  onSave={(v) => handleInlineSave(d.field, v)} disabled={!isManager} options={d.options} />
              );
            }
            return (
              <InlineEditField key={d.label} label={d.label} value={d.value}
                displayValue={supplierMatch ? (
                  <button onClick={() => navigate(`/suppliers/${supplierMatch.id}`)} className="text-sm font-medium text-primary hover:underline">{supplierMatch.company}</button>
                ) : d.field === "total_price" && d.value ? `$${d.value}` : undefined}
                type={d.field === "total_price" ? "number" : "text"}
                onSave={(v) => handleInlineSave(d.field, v)} disabled={d.isReadOnly || !isManager} options={d.options} />
            );
          })}
        </div>
      </div>

      {/* Dates Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {dateFields.map(d => {
          const date = d.value ? new Date(d.value) : undefined;
          return (
            <div key={d.field} className="bg-card rounded-xl border p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <d.icon className="h-3.5 w-3.5" />{d.label}
              </div>
              {isManager ? (
                <DateInput value={date} onChange={dt => handleDateSave(d.field, dt)} clearable />
              ) : (
                <div className="text-sm font-semibold text-foreground">{date ? date.toLocaleDateString("he-IL") : "—"}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Items with CRUD */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            <h2 className="font-semibold text-foreground">פריטים ({order.items.length})</h2>
          </div>
          {isManager && (
            <Button variant="outline" size="sm" onClick={openAddItem}>
              <Plus className="h-3.5 w-3.5 ml-1" />הוסף פריט
            </Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">כמות</th>
              <th className="text-right p-3 font-semibold text-foreground">מחיר יחידה</th>
              <th className="text-right p-3 font-semibold text-foreground">סה״כ</th>
              {isManager && <th className="text-right p-3 font-semibold text-foreground w-20">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.items.map(item => {
              const linkedProduct = item.product_id ? products.find(p => p.id === item.product_id) : products.find(p => p.name === item.name);
              return (
                <tr key={item.id} className={linkedProduct ? "cursor-pointer hover:bg-muted/30" : ""} onClick={() => linkedProduct && navigate(`/products/${linkedProduct.id}`)}>
                  <td className="p-3 font-medium text-foreground">
                    {linkedProduct ? <span className="text-primary hover:underline">{item.name}</span> : item.name}
                  </td>
                  <td className="p-3 text-muted-foreground">{item.qty}</td>
                  <td className="p-3 text-muted-foreground">{item.price ? `$${item.price}` : "—"}</td>
                  <td className="p-3 text-muted-foreground">{item.price ? `$${(item.price * item.qty).toLocaleString()}` : "—"}</td>
                  {isManager && (
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Payment Tracking - double-click to toggle */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">מעקב תשלומים</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">סה״כ לתשלום</p>
            <p className="text-lg font-bold text-foreground">{order.total_price ? `$${order.total_price.toLocaleString()}` : "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">תאריך תשלום</p>
            <p className="text-sm font-medium text-foreground">{order.payment_date ? new Date(order.payment_date).toLocaleDateString("he-IL") : "טרם שולם"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">סטטוס תשלום {isManager && <span className="text-xs text-muted-foreground/60">(לחיצה כפולה לשינוי)</span>}</p>
            {(() => {
              const ps = (order as any).payment_status || "ממתין";
              const colors: Record<string, string> = {
                "שולם": "bg-success/15 text-success",
                "שולם פיקדון": "bg-accent/15 text-accent",
                "ממתין": "bg-warning/15 text-warning",
              };
              return (
                <span
                  onDoubleClick={cyclePaymentStatus}
                  className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-xs font-medium select-none",
                    isManager && "cursor-pointer hover:ring-2 hover:ring-primary/30",
                    colors[ps] || "bg-muted text-muted-foreground"
                  )}
                >
                  {ps}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Workflow Timeline with advance */}
      <OrderWorkflowTimeline orderId={order.id} isManager={isManager} />

      {/* Documents */}
      <DocumentsSection orderId={order.id} />

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>מחיקת הזמנה</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">האם למחוק את ההזמנה? פעולה זו אינה ניתנת לביטול.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)}>ביטול</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>מחק</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Edit Dialog */}
      <Dialog open={editItemDialog} onOpenChange={setEditItemDialog}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editingItem ? "עריכת פריט" : "הוספת פריט"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>מוצר</Label>
              <Select value={itemProductId} onValueChange={v => {
                setItemProductId(v);
                setItemComponentId("");
                const p = products.find(p => p.id === v);
                if (p) { setItemName(p.name); setItemPrice(p.purchase_price?.toString() || ""); }
              }}>
                <SelectTrigger><SelectValue placeholder="בחר מוצר (אופציונלי)" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Component selector for composite products */}
            {itemProductId && (() => {
              const selectedProduct = products.find(p => p.id === itemProductId);
              const comps = selectedProduct?.components || [];
              if (comps.length === 0) return null;
              return (
                <div className="space-y-1">
                  <Label>רכיב (מתוך {selectedProduct?.name})</Label>
                  <Select value={itemComponentId} onValueChange={v => {
                    setItemComponentId(v);
                    const comp = comps.find(c => c.id === v);
                    if (comp) {
                      setItemName(`${comp.name} (${selectedProduct?.name})`);
                      setItemPrice(comp.price?.toString() || "");
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="בחר רכיב (אופציונלי)" /></SelectTrigger>
                    <SelectContent>
                      {comps.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.sku ? ` — ${c.sku}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div className="space-y-1">
              <Label>שם פריט</Label>
              <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="שם הפריט" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>כמות</Label>
                <Input type="number" value={itemQty} onChange={e => setItemQty(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>מחיר יחידה ($)</Label>
                <Input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSaveItem} disabled={!itemName.trim()} className="w-full">
              {editingItem ? "שמור שינויים" : "הוסף פריט"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderWorkflowTimeline({ orderId, isManager }: { orderId: string; isManager: boolean }) {
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkflow = async () => {
    const { data: inst } = await supabase
      .from("workflow_instances")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inst) { setLoading(false); return; }

    const { data: tpl } = await supabase.from("workflow_templates").select("*").eq("id", inst.template_id).single();
    const { data: logs } = await supabase.from("workflow_step_logs").select("*").eq("instance_id", inst.id).order("step_index", { ascending: true });

    setWorkflow({ ...inst, steps: (tpl?.steps as any[]) || [], logs: logs || [], templateName: tpl?.name });
    setLoading(false);
  };

  useEffect(() => { fetchWorkflow(); }, [orderId]);

  if (loading || !workflow) return null;

  const totalSteps = workflow.steps.length;
  const progress = workflow.status === "completed" ? 100 : Math.round((workflow.current_step / totalSteps) * 100);

  const advanceStep = async () => {
    if (workflow.current_step >= totalSteps - 1) {
      // Complete workflow
      await supabase.from("workflow_instances").update({ status: "completed", current_step: totalSteps }).eq("id", workflow.id);
      await supabase.from("workflow_step_logs").insert({
        instance_id: workflow.id,
        step_index: workflow.current_step,
        completed_by: "מנהל",
      });
    } else {
      await supabase.from("workflow_step_logs").insert({
        instance_id: workflow.id,
        step_index: workflow.current_step,
        completed_by: "מנהל",
      });
      await supabase.from("workflow_instances").update({ current_step: workflow.current_step + 1 }).eq("id", workflow.id);
    }
    toast.success(workflow.current_step >= totalSteps - 1 ? "תהליך הושלם" : "שלב קודם הושלם");
    await fetchWorkflow();
  };

  const goToStep = async (stepIdx: number) => {
    if (stepIdx === workflow.current_step) return;
    const newStatus = stepIdx >= totalSteps ? "completed" : "active";
    await supabase.from("workflow_instances").update({ current_step: stepIdx, status: newStatus }).eq("id", workflow.id);
    // Remove logs for steps after the new current step
    if (stepIdx < workflow.current_step) {
      await supabase.from("workflow_step_logs").delete().eq("instance_id", workflow.id).gte("step_index", stepIdx);
    }
    toast.success(`שלב ${stepIdx + 1}`);
    await fetchWorkflow();
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">{workflow.templateName || "תהליך רכש"}</h2>
        </div>
        <div className="flex items-center gap-2">
          {isManager && workflow.status === "active" && (
            <Button size="sm" variant="default" onClick={advanceStep}>
              {workflow.current_step >= totalSteps - 1 ? "סיים תהליך" : "קדם שלב"}
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            </Button>
          )}
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            workflow.status === "completed" ? "bg-success/15 text-success" :
            workflow.status === "cancelled" ? "bg-destructive/15 text-destructive" :
            "bg-primary/15 text-primary"
          )}>
            {workflow.status === "completed" ? "הושלם" : workflow.status === "cancelled" ? "בוטל" : "פעיל"}
          </span>
        </div>
      </div>
      <Progress value={progress} className="h-2 mb-4" />
      <div className="space-y-1">
        {workflow.steps.map((step: any, idx: number) => {
          const isCompleted = idx < workflow.current_step || workflow.status === "completed";
          const isCurrent = idx === workflow.current_step && workflow.status === "active";
          const log = workflow.logs.find((l: any) => l.step_index === idx);
          return (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-3 py-2 px-2 rounded-lg transition-colors",
                isManager && "cursor-pointer hover:bg-muted/50"
              )}
              onClick={() => isManager && goToStep(idx)}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs",
                isCompleted && "bg-success text-success-foreground",
                isCurrent && "bg-primary text-primary-foreground",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}>
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground")}>{step.name}</p>
                {log && (
                  <p className="text-xs text-muted-foreground">
                    {log.completed_by} • {new Date(log.completed_at).toLocaleDateString("he-IL")}
                    {log.notes && ` — ${log.notes}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
