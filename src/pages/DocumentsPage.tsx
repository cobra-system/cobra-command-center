import { useState, useEffect, useCallback } from "react";
import { useData, useAuth } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, ChevronLeft, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PurchaseDocument {
  id: string;
  type: string;
  supplier_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  currency: string;
  status: string;
  approval_date: string | null;
  approved_by: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
}

const statusFlow = ["ממתין לאישור", "אושר", "נשלח לספק", "בוצע"];
const statusColors: Record<string, string> = {
  "ממתין לאישור": "bg-warning/15 text-warning",
  "אושר": "bg-primary/15 text-primary",
  "נשלח לספק": "bg-accent/15 text-accent",
  "בוצע": "bg-success/15 text-success",
};

export default function DocumentsPage() {
  const { suppliers, products } = useData();
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Form state
  const [formType, setFormType] = useState<string>("PI");
  const [formSupplier, setFormSupplier] = useState("");
  const [formProduct, setFormProduct] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formUnitPrice, setFormUnitPrice] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formNotes, setFormNotes] = useState("");

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("purchase_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setDocs(data as PurchaseDocument[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleAdd = async () => {
    const qty = Number(formQty) || 0;
    const unitPrice = Number(formUnitPrice) || 0;
    await supabase.from("purchase_documents").insert({
      type: formType,
      supplier_id: formSupplier || null,
      product_id: formProduct || null,
      quantity: qty,
      unit_price: unitPrice,
      total_price: qty * unitPrice,
      currency: formCurrency,
      notes: formNotes || null,
    });
    toast.success("מסמך נוסף בהצלחה");
    setDialogOpen(false);
    setFormType("PI"); setFormSupplier(""); setFormProduct(""); setFormQty(""); setFormUnitPrice(""); setFormNotes("");
    fetchDocs();
  };

  const advanceStatus = async (doc: PurchaseDocument) => {
    const idx = statusFlow.indexOf(doc.status);
    if (idx < 0 || idx >= statusFlow.length - 1) return;
    const nextStatus = statusFlow[idx + 1];
    const updates: Record<string, any> = { status: nextStatus };
    if (nextStatus === "אושר") {
      updates.approval_date = new Date().toISOString();
      updates.approved_by = currentUser?.id;
    }
    await supabase.from("purchase_documents").update(updates).eq("id", doc.id);
    toast.success(`סטטוס עודכן ל-${nextStatus}`);
    fetchDocs();
  };

  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company || "—";
  const productName = (id: string | null) => products.find(p => p.id === id)?.name || "—";

  const filtered = docs.filter(d => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return supplierName(d.supplier_id).toLowerCase().includes(s) || productName(d.product_id).toLowerCase().includes(s);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">מסמכים (PI/PO)</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-1" />מסמך חדש</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>הוסף מסמך חדש</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>סוג</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PI">PI — הצעת מחיר</SelectItem>
                      <SelectItem value="PO">PO — הזמנת רכש</SelectItem>
                    </SelectContent>
                  </Select>
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
              </div>
              <div className="space-y-1">
                <Label>ספק</Label>
                <Select value={formSupplier} onValueChange={setFormSupplier}>
                  <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>מוצר</Label>
                <Select value={formProduct} onValueChange={setFormProduct}>
                  <SelectTrigger><SelectValue placeholder="בחר מוצר" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>כמות</Label>
                  <Input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>מחיר יחידה</Label>
                  <Input type="number" value={formUnitPrice} onChange={e => setFormUnitPrice(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>הערות</Label>
                <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} />
              </div>
              <Button onClick={handleAdd} className="w-full">הוסף מסמך</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חפש לפי ספק או מוצר..." className="pr-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 ml-1" /><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            {statusFlow.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="סוג" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="PI">PI</SelectItem>
            <SelectItem value="PO">PO</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">סוג</th>
              <th className="text-right p-3 font-semibold text-foreground">ספק</th>
              <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">כמות</th>
              <th className="text-right p-3 font-semibold text-foreground">מחיר כולל</th>
              <th className="text-right p-3 font-semibold text-foreground">מטבע</th>
              <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
              <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
              <th className="text-right p-3 font-semibold text-foreground">פעולה</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">אין מסמכים להצגה</td></tr>
            ) : (
              filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${doc.type === "PI" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                      {doc.type}
                    </span>
                  </td>
                  <td className="p-3 text-foreground">{supplierName(doc.supplier_id)}</td>
                  <td className="p-3 text-foreground">{productName(doc.product_id)}</td>
                  <td className="p-3 text-muted-foreground">{doc.quantity}</td>
                  <td className="p-3 text-muted-foreground font-mono" dir="ltr">{doc.total_price ? `${doc.total_price.toLocaleString()}` : "—"}</td>
                  <td className="p-3 text-muted-foreground">{doc.currency}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[doc.status] || "bg-muted text-muted-foreground"}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{format(new Date(doc.created_at), "dd/MM/yy")}</td>
                  <td className="p-3">
                    {statusFlow.indexOf(doc.status) < statusFlow.length - 1 && (
                      <Button variant="outline" size="sm" onClick={() => advanceStatus(doc)}>
                        <ChevronLeft className="h-3 w-3 ml-1" />קדם
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statusFlow.map(s => (
          <div key={s} className="bg-card rounded-xl border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{s}</p>
            <p className="text-2xl font-bold text-foreground">{docs.filter(d => d.status === s).length}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
