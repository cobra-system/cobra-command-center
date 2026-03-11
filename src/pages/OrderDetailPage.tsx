import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useData, useAuth, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { ArrowRight, Package, Truck, Calendar, DollarSign, FileText, Pencil, Trash2, CreditCard, Zap, Check } from "lucide-react";
import DocumentsSection from "@/components/DocumentsSection";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComp } from "@/components/ui/calendar";
import { InlineEditField } from "@/components/InlineEditField";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { orders, updateOrderStatus, updateOrder, deleteOrder, suppliers, products } = useData();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const order = orders.find(o => o.id === id);
  if (!order) return <div className="p-8 text-center text-muted-foreground">הזמנה לא נמצאה</div>;

  const supplier = order.supplier_id ? suppliers.find(s => s.id === order.supplier_id) : null;
  const isManager = currentUser?.role === "MANAGER";

  const handleDelete = async () => {
    await deleteOrder(order.id);
    toast.success("ההזמנה נמחקה");
    navigate("/orders");
  };

  const handleInlineSave = async (field: string, value: string) => {
    const updates: Record<string, any> = {};
    if (field === "total_price") {
      updates[field] = value ? Number(value) : null;
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

  // Inline date picker card
  const DateCard = ({ icon: Icon, label, field, value }: { icon: any; label: string; field: string; value: string | null | undefined }) => {
    const [open, setOpen] = useState(false);
    const date = value ? new Date(value) : undefined;
    return (
      <div className="bg-card rounded-xl border p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
          <Icon className="h-3.5 w-3.5" />{label}
        </div>
        {isManager ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="text-sm font-semibold text-foreground hover:text-primary hover:underline text-right w-full" title="לחץ לעריכה">
                {date ? date.toLocaleDateString("he-IL") : <span className="text-muted-foreground font-normal">לחץ לבחירה</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComp
                mode="single"
                selected={date}
                onSelect={(d) => { handleDateSave(field, d); setOpen(false); }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
              {date && (
                <div className="px-3 pb-3">
                  <button onClick={() => { handleDateSave(field, undefined); setOpen(false); }} className="text-xs text-destructive hover:underline">נקה תאריך</button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        ) : (
          <div className="text-sm font-semibold text-foreground">{date ? date.toLocaleDateString("he-IL") : "—"}</div>
        )}
      </div>
    );
  };

  // Inline text/number card
  const EditCard = ({ icon: Icon, label, field, value, type = "text" }: { icon: any; label: string; field: string; value: string | null | undefined; type?: "text" | "number" }) => (
    <div className="bg-card rounded-xl border p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      {isManager ? (
        <InlineEditField
          value={value ?? ""}
          onSave={(v) => handleInlineSave(field, v)}
          type={type}
        />
      ) : (
        <div className="text-sm font-semibold text-foreground">{value || "—"}</div>
      )}
    </div>
  );

  // Read-only info card
  const InfoCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: any }) => (
    <div className="bg-card rounded-xl border p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value || "—"}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">תיק הזמנה</h1>
          <p className="text-sm text-muted-foreground">
            {order.items.map(i => i.name).join(", ")}
          </p>
        </div>
        {isManager && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 ml-1" />עריכה
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 ml-1" />מחיקה
            </Button>
          </>
        )}
        <PriorityBadge priority={order.priority as Priority} />
      </div>

      {/* Status + quick info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">סטטוס</div>
          <Select value={order.status} onValueChange={v => updateOrderStatus(order.id, v as OrderStatus)}>
            <SelectTrigger className="h-8">
              <SelectValue>
                <OrderStatusBadge status={order.status as OrderStatus} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <InfoCard
          icon={Truck}
          label="ספק"
          value={
            supplier ? (
              <button onClick={() => navigate(`/suppliers/${supplier.id}`)} className="text-primary hover:underline">
                {supplier.company}
              </button>
            ) : order.supplier_name || "—"
          }
        />
        <InfoCard icon={Calendar} label="תאריך הזמנה" value={order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"} />
        <EditCard icon={DollarSign} label="סה״כ" field="total_price" value={order.total_price?.toString() ?? ""} type="number" />
      </div>

      {/* Dates & shipping */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DateCard icon={Calendar} label="ETD (יציאה)" field="etd" value={order.etd} />
        <DateCard icon={Calendar} label="ETA (הגעה)" field="eta" value={order.eta} />
        <EditCard icon={Truck} label="שיטת משלוח" field="shipping" value={order.shipping ?? ""} />
        <DateCard icon={CreditCard} label="תאריך תשלום" field="payment_date" value={order.payment_date} />
      </div>

      {/* Items */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-foreground">פריטים ({order.items.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">כמות</th>
              <th className="text-right p-3 font-semibold text-foreground">מחיר יחידה</th>
              <th className="text-right p-3 font-semibold text-foreground">סה״כ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.items.map(item => {
              const linkedProduct = item.product_id ? products.find(p => p.id === item.product_id) : products.find(p => p.name === item.name);
              return (
                <tr key={item.id} className={linkedProduct ? "cursor-pointer hover:bg-muted/30" : ""} onClick={() => linkedProduct && navigate(`/products/${linkedProduct.id}`)}>
                  <td className="p-3 font-medium text-foreground">
                    {linkedProduct ? (
                      <span className="text-primary hover:underline">{item.name}</span>
                    ) : item.name}
                  </td>
                  <td className="p-3 text-muted-foreground">{item.qty}</td>
                  <td className="p-3 text-muted-foreground">{item.price ? `$${item.price}` : "—"}</td>
                  <td className="p-3 text-muted-foreground">{item.price ? `$${(item.price * item.qty).toLocaleString()}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Payment Tracking */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">מעקב תשלומים</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">סה״כ לתשלום</p>
            <p className="text-lg font-bold text-foreground">{order.total_price ? `$${order.total_price.toLocaleString()}` : "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">תאריך תשלום</p>
            <p className="text-sm font-medium text-foreground">{order.payment_date ? new Date(order.payment_date).toLocaleDateString("he-IL") : "טרם שולם"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">סטטוס תשלום</p>
            <span className={cn(
              "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
              order.payment_date ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            )}>
              {order.payment_date ? "שולם" : "ממתין לתשלום"}
            </span>
          </div>
          {isManager && !order.payment_date && (
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={() => updateOrder(order.id, { payment_date: new Date().toISOString() } as any)}>
                סמן כשולם
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Workflow Timeline */}
      <OrderWorkflowTimeline orderId={order.id} />

      {/* Notes */}
      <div className="bg-card rounded-xl border p-4 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
          <FileText className="h-3.5 w-3.5" />
          הערות
        </div>
        {isManager ? (
          <InlineEditField
            value={order.notes}
            onSave={(v) => handleInlineSave("notes", v)}
            displayValue={order.notes ? <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p> : <p className="text-sm text-muted-foreground">לחץ פעמיים להוספת הערה</p>}
          />
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes || "—"}</p>
        )}
      </div>

      {/* Documents */}
      {order.supplier_id && <DocumentsSection supplierId={order.supplier_id} />}

      {/* Edit Dialog */}
      <OrderEditDialog open={editOpen} onOpenChange={setEditOpen} order={order} suppliers={suppliers} onSave={updateOrder} />

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
    </div>
  );
}

function OrderWorkflowTimeline({ orderId }: { orderId: string }) {
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: inst } = await supabase
        .from("workflow_instances")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!inst) { setLoading(false); return; }

      const { data: tpl } = await supabase
        .from("workflow_templates")
        .select("*")
        .eq("id", inst.template_id)
        .single();

      const { data: logs } = await supabase
        .from("workflow_step_logs")
        .select("*")
        .eq("instance_id", inst.id)
        .order("step_index", { ascending: true });

      setWorkflow({
        ...inst,
        steps: (tpl?.steps as any[]) || [],
        logs: logs || [],
        templateName: tpl?.name,
      });
      setLoading(false);
    };
    fetch();
  }, [orderId]);

  if (loading) return null;
  if (!workflow) return null;

  const totalSteps = workflow.steps.length;
  const progress = workflow.status === "completed" ? 100 : Math.round((workflow.current_step / totalSteps) * 100);

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">{workflow.templateName || "תהליך רכש"}</h2>
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-xs font-medium",
          workflow.status === "completed" ? "bg-success/15 text-success" :
          workflow.status === "cancelled" ? "bg-destructive/15 text-destructive" :
          "bg-primary/15 text-primary"
        )}>
          {workflow.status === "completed" ? "הושלם" : workflow.status === "cancelled" ? "בוטל" : "פעיל"}
        </span>
      </div>

      <Progress value={progress} className="h-2 mb-4" />

      <div className="space-y-1">
        {workflow.steps.map((step: any, idx: number) => {
          const isCompleted = idx < workflow.current_step || workflow.status === "completed";
          const isCurrent = idx === workflow.current_step && workflow.status === "active";
          const log = workflow.logs.find((l: any) => l.step_index === idx);

          return (
            <div key={idx} className="flex items-start gap-3 py-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs",
                isCompleted && "bg-success text-success-foreground",
                isCurrent && "bg-primary text-primary-foreground",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}>
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground")}>
                  {step.name}
                </p>
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

function OrderEditDialog({ open, onOpenChange, order, suppliers, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  suppliers: any[];
  onSave: (id: string, updates: any) => Promise<void>;
}) {
  const [priority, setPriority] = useState(order.priority);
  const [supplierId, setSupplierId] = useState(order.supplier_id || "");
  const [shipping, setShipping] = useState(order.shipping || "");
  const [notes, setNotes] = useState(order.notes || "");
  const [etd, setEtd] = useState<Date | undefined>(order.etd ? new Date(order.etd) : undefined);
  const [eta, setEta] = useState<Date | undefined>(order.eta ? new Date(order.eta) : undefined);
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(order.payment_date ? new Date(order.payment_date) : undefined);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const supplier = suppliers.find((s: any) => s.id === supplierId);
    await onSave(order.id, {
      priority,
      supplier_id: supplierId || null,
      supplier_name: supplier?.company || null,
      shipping: shipping || null,
      notes: notes || null,
      etd: etd?.toISOString() || null,
      eta: eta?.toISOString() || null,
      payment_date: paymentDate?.toISOString() || null,
    });
    toast.success("ההזמנה עודכנה");
    setSaving(false);
    onOpenChange(false);
  };

  const DateField = ({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-right font-normal text-sm", !value && "text-muted-foreground")}>
            <Calendar className="h-4 w-4 ml-2" />
            {value ? format(value, "dd/MM/yyyy") : "בחר תאריך"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComp mode="single" selected={value} onSelect={d => onChange(d)} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>עריכת הזמנה</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">עדיפות</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ספק</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">שיטת משלוח</Label><Input value={shipping} onChange={e => setShipping(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <DateField label="ETD (יציאה)" value={etd} onChange={setEtd} />
            <DateField label="ETA (הגעה)" value={eta} onChange={setEta} />
            <DateField label="תאריך תשלום" value={paymentDate} onChange={setPaymentDate} />
          </div>
          <div className="space-y-1"><Label className="text-xs">הערות</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "שומר..." : "שמור שינויים"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
