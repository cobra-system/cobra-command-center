import { useState, useEffect, useCallback } from "react";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Plus, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, isThisWeek, isPast } from "date-fns";

interface Payment {
  id: string;
  supplier_id: string | null;
  order_id: string | null;
  amount: number;
  currency: string;
  payment_type: string;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  "ממתין": "bg-warning/15 text-warning",
  "שולם": "bg-success/15 text-success",
  "מאוחר": "bg-destructive/15 text-destructive",
};

const currencySymbol: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪" };

export default function PaymentsPage() {
  const { suppliers, orders } = useData();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formSupplier, setFormSupplier] = useState("");
  const [formOrder, setFormOrder] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formType, setFormType] = useState("Full");
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("supplier_payments").select("*").order("created_at", { ascending: false });
    if (data) setPayments(data as Payment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleAdd = async () => {
    await supabase.from("supplier_payments").insert({
      supplier_id: formSupplier || null,
      order_id: formOrder || null,
      amount: Number(formAmount) || 0,
      currency: formCurrency,
      payment_type: formType,
      due_date: formDueDate || null,
      notes: formNotes || null,
    });
    toast.success("תשלום נוסף בהצלחה");
    setDialogOpen(false);
    setFormSupplier(""); setFormOrder(""); setFormAmount(""); setFormDueDate(""); setFormNotes("");
    fetchPayments();
  };

  const markPaid = async (id: string) => {
    await supabase.from("supplier_payments").update({ status: "שולם", paid_date: new Date().toISOString().split("T")[0] }).eq("id", id);
    toast.success("סומן כשולם");
    fetchPayments();
  };

  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company || "—";

  const totalOwed = payments.filter(p => p.status !== "שולם").reduce((sum, p) => sum + p.amount, 0);
  const dueThisWeek = payments.filter(p => p.status !== "שולם" && p.due_date && isThisWeek(new Date(p.due_date))).length;
  const overdue = payments.filter(p => p.status !== "שולם" && p.due_date && isPast(new Date(p.due_date))).length;

  const filtered = payments.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search) return supplierName(p.supplier_id).toLowerCase().includes(search.toLowerCase());
    return true;
  });

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">תשלומים לספקים</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" />תשלום חדש</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>הוסף תשלום חדש</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>ספק</Label>
                <Select value={formSupplier} onValueChange={setFormSupplier}>
                  <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>הזמנה מקושרת (אופציונלי)</Label>
                <Select value={formOrder} onValueChange={setFormOrder}>
                  <SelectTrigger><SelectValue placeholder="בחר הזמנה" /></SelectTrigger>
                  <SelectContent>{orders.map(o => <SelectItem key={o.id} value={o.id}>{o.supplier_name || o.id.slice(0, 8)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>סכום</Label>
                  <Input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>מטבע</Label>
                  <Select value={formCurrency} onValueChange={setFormCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD $</SelectItem>
                      <SelectItem value="EUR">EUR €</SelectItem>
                      <SelectItem value="ILS">ILS ₪</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>סוג</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full">מלא</SelectItem>
                      <SelectItem value="Deposit">מקדמה</SelectItem>
                      <SelectItem value="Balance">יתרה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>מועד פירעון</Label>
                <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>הערות</Label>
                <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} />
              </div>
              <Button onClick={handleAdd} className="w-full">הוסף תשלום</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">סה״כ חוב פתוח</p>
          <p className="text-2xl font-bold text-foreground">${totalOwed.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">לתשלום השבוע</p>
          <p className="text-2xl font-bold text-warning">{dueThisWeek}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">באיחור</p>
          <p className="text-2xl font-bold text-destructive flex items-center justify-center gap-1">
            {overdue > 0 && <AlertTriangle className="h-5 w-5" />}{overdue}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חפש לפי ספק..." className="pr-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="ממתין">ממתין</SelectItem>
            <SelectItem value="שולם">שולם</SelectItem>
            <SelectItem value="מאוחר">מאוחר</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">ספק</th>
              <th className="text-right p-3 font-semibold text-foreground">סכום</th>
              <th className="text-right p-3 font-semibold text-foreground">סוג</th>
              <th className="text-right p-3 font-semibold text-foreground">מועד פירעון</th>
              <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
              <th className="text-right p-3 font-semibold text-foreground">תאריך תשלום</th>
              <th className="text-right p-3 font-semibold text-foreground">פעולה</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">אין תשלומים להצגה</td></tr>
            ) : (
              filtered.map(p => {
                const isOverdue = p.status !== "שולם" && p.due_date && isPast(new Date(p.due_date));
                return (
                  <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${isOverdue ? "bg-destructive/5" : ""}`}>
                    <td className="p-3 font-medium text-foreground">{supplierName(p.supplier_id)}</td>
                    <td className="p-3 text-foreground font-mono" dir="ltr">{currencySymbol[p.currency] || ""}{p.amount.toLocaleString()}</td>
                    <td className="p-3 text-muted-foreground">{p.payment_type === "Deposit" ? "מקדמה" : p.payment_type === "Balance" ? "יתרה" : "מלא"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{p.due_date ? format(new Date(p.due_date), "dd/MM/yy") : "—"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[isOverdue ? "מאוחר" : p.status] || "bg-muted text-muted-foreground"}`}>
                        {isOverdue ? "מאוחר" : p.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{p.paid_date ? format(new Date(p.paid_date), "dd/MM/yy") : "—"}</td>
                    <td className="p-3">
                      {p.status !== "שולם" && (
                        <Button variant="success" size="sm" onClick={() => markPaid(p.id)}>סמן כשולם</Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
