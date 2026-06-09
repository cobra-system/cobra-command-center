import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CreditCard, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import type { OrderPayment } from "@/contexts/types";
import { useAuth, useCurrency } from "@/contexts/AppContext";
import { canSeePrices } from "@/lib/permissions";

import { format } from "date-fns";
const COLUMN_DEFS: ColDef[] = [
  { id: "payment_type", label: "סוג",          sortField: "payment_type" },
  { id: "percentage",   label: "אחוז" },
  { id: "amount",       label: "סכום",         sortField: "amount" },
  { id: "currency",     label: "מטבע" },
  { id: "due_date",     label: "מועד פירעון",  sortField: "due_date" },
  { id: "status",       label: "סטטוס",        sortField: "status" },
  { id: "paid_date",    label: "תאריך תשלום",  sortField: "paid_date" },
  { id: "swift_ref",    label: "Swift Ref" },
  { id: "notes",        label: "הערות" },
] as const;

type SortField = "payment_type" | "amount" | "due_date" | "status" | "paid_date";
type SortDir = "asc" | "desc" | null;

interface Props {
  orderId: string;
  orderTotal?: number | null;
  hasEdit: boolean;
}

const paymentTypeLabel: Record<string, string> = {
  Deposit: "מקדמה",
  Balance: "יתרה",
  Full: "מלא",
};

const typeColors: Record<string, string> = {
  Deposit: "bg-accent/15 text-accent",
  Balance: "bg-primary/15 text-primary",
  Full: "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  "שולם": "bg-success/15 text-success",
  "ממתין": "bg-warning/15 text-warning",
};

export function OrderPaymentsSection({ orderId, orderTotal, hasEdit }: Props) {
  const { currentUser } = useAuth();
  const { formatPrice } = useCurrency();
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<OrderPayment | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Form state
  const [formType, setFormType] = useState<"Deposit" | "Balance" | "Full">("Deposit");
  const [formPct, setFormPct] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState<"USD" | "EUR" | "ILS">("USD");
  const [formDueDate, setFormDueDate] = useState<Date | undefined>();
  const [formSwift, setFormSwift] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "order-payments:hidden-columns",
    COLUMN_DEFS,
    ["percentage", "notes"]
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const fetchPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from("order_payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (!error && data) setPayments(data as OrderPayment[]);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field); setSortDir("asc");
    }
  };

  const sorted = [...payments].sort((a, b) => {
    if (!sortField || !sortDir) return 0;
    let cmp = 0;
    if (sortField === "amount") cmp = (a.amount || 0) - (b.amount || 0);
    else if (sortField === "due_date") cmp = (a.due_date || "").localeCompare(b.due_date || "");
    else if (sortField === "paid_date") cmp = (a.paid_date || "").localeCompare(b.paid_date || "");
    else if (sortField === "payment_type") cmp = (a.payment_type || "").localeCompare(b.payment_type || "");
    else if (sortField === "status") cmp = (a.status || "").localeCompare(b.status || "");
    return sortDir === "desc" ? -cmp : cmp;
  });

  const totalScheduled = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalPaid = payments.filter(p => p.status === "שולם").reduce((s, p) => s + (p.amount || 0), 0);
  const remaining = totalScheduled - totalPaid;

  const openAdd = () => {
    setEditingPayment(null);
    setFormType("Deposit");
    setFormPct("");
    setFormAmount("");
    setFormCurrency("USD");
    setFormDueDate(undefined);
    setFormSwift("");
    setFormNotes("");
    setShowForm(true);
  };

  const openEdit = (p: OrderPayment) => {
    setEditingPayment(p);
    setFormType(p.payment_type);
    setFormPct(p.percentage?.toString() || "");
    setFormAmount(p.amount?.toString() || "");
    setFormCurrency(p.currency || "USD");
    setFormDueDate(p.due_date ? new Date(p.due_date) : undefined);
    setFormSwift(p.swift_reference || "");
    setFormNotes(p.notes || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formAmount || isNaN(Number(formAmount))) {
      toast.error("יש להזין סכום תקין");
      return;
    }
    setSaving(true);
    const payload = {
      order_id: orderId,
      payment_type: formType,
      percentage: formPct ? Number(formPct) : null,
      amount: Number(formAmount),
      currency: formCurrency,
      due_date: formDueDate ? formDueDate.toISOString().split("T")[0] : null,
      swift_reference: formSwift || null,
      notes: formNotes || null,
      status: editingPayment?.status || "ממתין",
    };
    const { error } = editingPayment
      ? await supabase.from("order_payments").update(payload).eq("id", editingPayment.id)
      : await supabase.from("order_payments").insert(payload);
    setSaving(false);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    toast.success(editingPayment ? "תשלום עודכן" : "תשלום נוסף");
    setShowForm(false);
    fetchPayments();
  };

  const markPaid = async (id: string) => {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("order_payments")
      .update({ status: "שולם", paid_date: today })
      .eq("id", id);
    if (error) { toast.error("שגיאה"); return; }
    toast.success("תשלום סומן כשולם");
    fetchPayments();
  };

  const markPending = async (id: string) => {
    const { error } = await supabase
      .from("order_payments")
      .update({ status: "ממתין", paid_date: null })
      .eq("id", id);
    if (error) { toast.error("שגיאה"); return; }
    toast.success("תשלום סומן כממתין");
    fetchPayments();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("order_payments").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    toast.success("תשלום נמחק");
    fetchPayments();
  };

  const updateSwift = async (id: string, swift: string) => {
    const { error } = await supabase
      .from("order_payments")
      .update({ swift_reference: swift || null })
      .eq("id", id);
    if (error) { toast.error("שגיאה"); return; }
    toast.success("אסמכתא עודכנה");
    fetchPayments();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-muted-foreground/40">⇅</span>;
    return sortDir === "asc" ? <span>↑</span> : <span>↓</span>;
  };

  if (loading) return null;
  if (!canSeePrices(currentUser)) return null;

  return (
    <>
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-accent" />
            <h2 className="font-semibold text-foreground">תזמון תשלומים ({payments.length})</h2>
          </div>
          {hasEdit && (
            <Button variant="outline" size="sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5 ml-1" />הוסף תשלום
            </Button>
          )}
        </div>

        {/* Summary bar */}
        {payments.length > 0 && (
          <div className="px-4 py-3 bg-muted/30 border-b grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">סה״כ מתוכנן: </span>
              <span className={cn("font-semibold", orderTotal && Math.abs(totalScheduled - orderTotal) > 1 ? "text-warning" : "")}>
                {formatPrice(totalScheduled)}
              </span>
              {orderTotal && Math.abs(totalScheduled - orderTotal) > 1 && (
                <span className="text-xs text-muted-foreground mr-1">(ס״כ הזמנה: {formatPrice(orderTotal)})</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground text-xs">שולם: </span>
              <span className="font-semibold text-success">{formatPrice(totalPaid)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">נותר: </span>
              <span className={cn("font-semibold", remaining > 0 ? "text-warning" : "text-success")}>
                {formatPrice(remaining)}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto" dir="rtl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
                {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                  <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                    {col.sortField ? (
                      <button onClick={() => toggleSort(col.sortField as SortField)} className="flex items-center gap-1 hover:text-primary transition-colors">
                        {col.label} <SortIcon field={col.sortField as SortField} />
                      </button>
                    ) : col.label}
                  </th>
                ) : null)}
                {hasEdit && <th className="p-3 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={visibleCount + (hasEdit ? 1 : 0)} className="p-6 text-center text-muted-foreground text-sm">
                    אין תשלומים מתוכננים להזמנה זו
                  </td>
                </tr>
              ) : sorted.map(p => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  {isVisible("payment_type") && (
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", typeColors[p.payment_type] || "bg-muted text-muted-foreground")}>
                        {paymentTypeLabel[p.payment_type] || p.payment_type}
                      </span>
                    </td>
                  )}
                  {isVisible("percentage") && (
                    <td className="p-3 text-muted-foreground text-xs">{p.percentage ? `${p.percentage}%` : "—"}</td>
                  )}
                  {isVisible("amount") && (
                    <td className="p-3 font-medium">
                      {p.amount ? formatPrice(p.amount, p.currency) : "—"}
                    </td>
                  )}
                  {isVisible("currency") && (
                    <td className="p-3 text-muted-foreground text-xs">{p.currency || "—"}</td>
                  )}
                  {isVisible("due_date") && (
                    <td className="p-3 text-muted-foreground text-xs">
                      {p.due_date ? format(new Date(p.due_date), "dd/MM/yyyy") : "—"}
                    </td>
                  )}
                  {isVisible("status") && (
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      {hasEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={cn("px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity", statusColors[p.status] || "bg-muted text-muted-foreground")}>
                              {p.status}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1" align="start">
                            {p.status === "ממתין" && (
                              <button
                                onClick={() => markPaid(p.id)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors text-success"
                              >
                                <Check className="h-3 w-3" />סמן כשולם
                              </button>
                            )}
                            {p.status === "שולם" && (
                              <button
                                onClick={() => markPending(p.id)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors text-warning"
                              >
                                ↺ סמן כממתין
                              </button>
                            )}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[p.status] || "bg-muted text-muted-foreground")}>
                          {p.status}
                        </span>
                      )}
                    </td>
                  )}
                  {isVisible("paid_date") && (
                    <td className="p-3 text-muted-foreground text-xs">
                      {p.paid_date ? format(new Date(p.paid_date), "dd/MM/yyyy") : "—"}
                    </td>
                  )}
                  {isVisible("swift_ref") && (
                    <td className="p-3 text-muted-foreground text-xs font-mono" onClick={e => e.stopPropagation()}>
                      {hasEdit ? (
                        <input
                          className="text-xs font-mono bg-transparent border-b border-dashed border-muted-foreground/30 focus:outline-none focus:border-primary w-full min-w-[100px]"
                          defaultValue={p.swift_reference || ""}
                          placeholder="SWIFT..."
                          onBlur={e => { if (e.target.value !== (p.swift_reference || "")) updateSwift(p.id, e.target.value); }}
                        />
                      ) : (p.swift_reference || "—")}
                    </td>
                  )}
                  {isVisible("notes") && (
                    <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{p.notes || "—"}</td>
                  )}
                  {hasEdit && (
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(p)}>
                          ✎
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingPayment ? "עריכת תשלום" : "הוספת תשלום"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>סוג תשלום</Label>
                <Select value={formType} onValueChange={v => setFormType(v as "Deposit" | "Balance" | "Full")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deposit">מקדמה</SelectItem>
                    <SelectItem value="Balance">יתרה</SelectItem>
                    <SelectItem value="Full">מלא</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>אחוז (אופציונלי)</Label>
                <Input value={formPct} onChange={e => setFormPct(e.target.value)} placeholder="15" type="number" min="0" max="100" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>סכום</Label>
                <Input value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0" type="number" min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>מטבע</Label>
                <Select value={formCurrency} onValueChange={v => setFormCurrency(v as "USD" | "EUR" | "ILS")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD $</SelectItem>
                    <SelectItem value="EUR">EUR €</SelectItem>
                    <SelectItem value="ILS">ILS ₪</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>מועד פירעון</Label>
              <DateInput value={formDueDate} onChange={setFormDueDate} clearable />
            </div>
            <div className="space-y-1.5">
              <Label>אסמכתא SWIFT</Label>
              <Input value={formSwift} onChange={e => setFormSwift(e.target.value)} placeholder="SWIFT reference..." className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>הערות</Label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="הערות..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>ביטול</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "שומר..." : "שמור"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => { setSortField(field as SortField); setSortDir("asc"); }}
          onSortDesc={field => { setSortField(field as SortField); setSortDir("desc"); }}
        />
      )}
    </>
  );
}
