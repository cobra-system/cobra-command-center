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
import { FileText, Plus, ChevronLeft, Search, Filter, Upload, CreditCard, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, isThisWeek, isPast } from "date-fns";

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

const docStatusFlow = ["ממתין לאישור", "אושר", "נשלח לספק", "בוצע"];
const docStatusColors: Record<string, string> = {
  "ממתין לאישור": "bg-warning/15 text-warning",
  "אושר": "bg-primary/15 text-primary",
  "נשלח לספק": "bg-accent/15 text-accent",
  "בוצע": "bg-success/15 text-success",
};
const payStatusColors: Record<string, string> = {
  "ממתין": "bg-warning/15 text-warning",
  "שולם": "bg-success/15 text-success",
  "מאוחר": "bg-destructive/15 text-destructive",
};
const currencySymbol: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪" };

export default function DocumentsPage() {
  const { suppliers, products, orders } = useData();
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("documents");
  const [search, setSearch] = useState("");

  // Document dialog
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [formType, setFormType] = useState("PI");
  const [formSupplier, setFormSupplier] = useState("");
  const [formProduct, setFormProduct] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formUnitPrice, setFormUnitPrice] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formNotes, setFormNotes] = useState("");

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [paySupplier, setPaySupplier] = useState("");
  const [payOrder, setPayOrder] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("USD");
  const [payType, setPayType] = useState("Full");
  const [payDueDate, setPayDueDate] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Upload
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [docsRes, paysRes] = await Promise.all([
      supabase.from("purchase_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_payments").select("*").order("created_at", { ascending: false }),
    ]);
    if (docsRes.data) setDocs(docsRes.data as PurchaseDocument[]);
    if (paysRes.data) setPayments(paysRes.data as Payment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company || "—";
  const productName = (id: string | null) => products.find(p => p.id === id)?.name || "—";

  // Add document
  const handleAddDoc = async () => {
    const qty = Number(formQty) || 0;
    const unitPrice = Number(formUnitPrice) || 0;
    await supabase.from("purchase_documents").insert({
      type: formType, supplier_id: formSupplier || null, product_id: formProduct || null,
      quantity: qty, unit_price: unitPrice, total_price: qty * unitPrice,
      currency: formCurrency, notes: formNotes || null,
    });
    toast.success("מסמך נוסף");
    setDocDialogOpen(false);
    setFormType("PI"); setFormSupplier(""); setFormProduct(""); setFormQty(""); setFormUnitPrice(""); setFormNotes("");
    fetchData();
  };

  const advanceStatus = async (doc: PurchaseDocument) => {
    const idx = docStatusFlow.indexOf(doc.status);
    if (idx < 0 || idx >= docStatusFlow.length - 1) return;
    const nextStatus = docStatusFlow[idx + 1];
    const updates: Record<string, any> = { status: nextStatus };
    if (nextStatus === "אושר") {
      updates.approval_date = new Date().toISOString();
      updates.approved_by = currentUser?.id;
    }
    await supabase.from("purchase_documents").update(updates).eq("id", doc.id);
    toast.success(`סטטוס → ${nextStatus}`);
    fetchData();
  };

  // Add payment
  const handleAddPayment = async () => {
    await supabase.from("supplier_payments").insert({
      supplier_id: paySupplier || null, order_id: payOrder || null,
      amount: Number(payAmount) || 0, currency: payCurrency,
      payment_type: payType, due_date: payDueDate || null, notes: payNotes || null,
    });
    toast.success("תשלום נוסף");
    setPayDialogOpen(false);
    setPaySupplier(""); setPayOrder(""); setPayAmount(""); setPayDueDate(""); setPayNotes("");
    fetchData();
  };

  const markPaid = async (id: string) => {
    await supabase.from("supplier_payments").update({ status: "שולם", paid_date: new Date().toISOString().split("T")[0] }).eq("id", id);
    toast.success("סומן כשולם");
    fetchData();
  };

  // File upload + AI classification
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setClassificationResult(null);

    // Upload to storage
    const ext = file.name.split(".").pop();
    const path = `uploads/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      toast.error("שגיאה בהעלאה: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    const fileUrl = urlData.publicUrl;
    setUploading(false);

    // Extract text for classification
    setClassifying(true);
    let textContent = "";
    if (file.type === "application/pdf" || file.type.includes("text")) {
      try {
        textContent = await file.text();
      } catch {
        textContent = "";
      }
    }

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/classify-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ text: textContent.slice(0, 5000), filename: file.name }),
      });
      if (res.ok) {
        const result = await res.json();
        setClassificationResult({ ...result, file_url: fileUrl, filename: file.name });
        toast.success(`סווג כ-${result.type} (ביטחון: ${Math.round((result.confidence || 0) * 100)}%)`);
      }
    } catch {
      toast.error("שגיאה בסיווג");
    }
    setClassifying(false);
  };

  const saveClassifiedDocument = async () => {
    if (!classificationResult) return;
    const r = classificationResult;

    if (r.type === "PAYMENT") {
      const matchedSupplier = suppliers.find(s => 
        s.company.toLowerCase().includes((r.supplier_name || "").toLowerCase())
      );
      await supabase.from("supplier_payments").insert({
        supplier_id: matchedSupplier?.id || null,
        amount: r.total_amount || 0,
        currency: r.currency || "USD",
        notes: `קובץ: ${r.filename}`,
      });
    } else {
      const matchedSupplier = suppliers.find(s => 
        s.company.toLowerCase().includes((r.supplier_name || "").toLowerCase())
      );
      await supabase.from("purchase_documents").insert({
        type: r.type === "OTHER" ? "PI" : r.type,
        supplier_id: matchedSupplier?.id || null,
        quantity: 0,
        currency: r.currency || "USD",
        total_price: r.total_amount || null,
        file_url: r.file_url,
        notes: `קובץ: ${r.filename}`,
      });
    }
    toast.success("מסמך נשמר בהצלחה");
    setClassificationResult(null);
    setUploadDialogOpen(false);
    fetchData();
  };

  // Filter
  const filteredDocs = docs.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return supplierName(d.supplier_id).toLowerCase().includes(s) || productName(d.product_id).toLowerCase().includes(s);
  });
  const filteredPayments = payments.filter(p => {
    if (!search) return true;
    return supplierName(p.supplier_id).toLowerCase().includes(search.toLowerCase());
  });

  // Payment summary
  const totalOwed = payments.filter(p => p.status !== "שולם").reduce((s, p) => s + p.amount, 0);
  const overdue = payments.filter(p => p.status !== "שולם" && p.due_date && isPast(new Date(p.due_date))).length;

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">מסמכים</h1>
        </div>
        <div className="flex gap-2">
          {/* Upload button */}
          <Dialog open={uploadDialogOpen} onOpenChange={(v) => { setUploadDialogOpen(v); if (!v) setClassificationResult(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="h-4 w-4 ml-1" />העלה קובץ</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>העלאת מסמך</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">העלה PDF או מסמך והמערכת תסווג אותו אוטומטית באמצעות AI.</p>
                <Input type="file" accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.jpg,.png" onChange={handleFileUpload} disabled={uploading || classifying} />
                {uploading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />מעלה...</div>}
                {classifying && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />מסווג עם AI...</div>}
                {classificationResult && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-sm text-foreground">תוצאת סיווג:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">סוג:</span>
                      <span className="font-medium text-foreground">{classificationResult.type}</span>
                      {classificationResult.supplier_name && (
                        <><span className="text-muted-foreground">ספק:</span><span className="text-foreground">{classificationResult.supplier_name}</span></>
                      )}
                      {classificationResult.total_amount && (
                        <><span className="text-muted-foreground">סכום:</span><span className="text-foreground">{classificationResult.currency || "$"}{classificationResult.total_amount}</span></>
                      )}
                      <span className="text-muted-foreground">ביטחון:</span>
                      <span className="text-foreground">{Math.round((classificationResult.confidence || 0) * 100)}%</span>
                    </div>
                    <Button onClick={saveClassifiedDocument} className="w-full mt-2">שמור מסמך</Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Add document */}
          {tab === "documents" && (
            <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" />מסמך חדש</Button></DialogTrigger>
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
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>מוצר</Label>
                    <Select value={formProduct} onValueChange={setFormProduct}>
                      <SelectTrigger><SelectValue placeholder="בחר מוצר" /></SelectTrigger>
                      <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>כמות</Label><Input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} /></div>
                    <div className="space-y-1"><Label>מחיר יחידה</Label><Input type="number" value={formUnitPrice} onChange={e => setFormUnitPrice(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1"><Label>הערות</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} /></div>
                  <Button onClick={handleAddDoc} className="w-full">הוסף מסמך</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Add payment */}
          {tab === "payments" && (
            <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" />תשלום חדש</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>הוסף תשלום חדש</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label>ספק</Label>
                    <Select value={paySupplier} onValueChange={setPaySupplier}>
                      <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>הזמנה מקושרת (אופציונלי)</Label>
                    <Select value={payOrder} onValueChange={setPayOrder}>
                      <SelectTrigger><SelectValue placeholder="בחר הזמנה" /></SelectTrigger>
                      <SelectContent>{orders.map(o => <SelectItem key={o.id} value={o.id}>{o.supplier_name || o.id.slice(0, 8)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label>סכום</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
                    <div className="space-y-1">
                      <Label>מטבע</Label>
                      <Select value={payCurrency} onValueChange={setPayCurrency}>
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
                      <Select value={payType} onValueChange={setPayType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full">מלא</SelectItem>
                          <SelectItem value="Deposit">מקדמה</SelectItem>
                          <SelectItem value="Balance">יתרה</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1"><Label>מועד פירעון</Label><Input type="date" value={payDueDate} onChange={e => setPayDueDate(e.target.value)} /></div>
                  <div className="space-y-1"><Label>הערות</Label><Textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} rows={2} /></div>
                  <Button onClick={handleAddPayment} className="w-full">הוסף תשלום</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חפש לפי ספק או מוצר..." className="pr-10" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">PI</p>
          <p className="text-2xl font-bold text-foreground">{docs.filter(d => d.type === "PI").length}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">PO</p>
          <p className="text-2xl font-bold text-foreground">{docs.filter(d => d.type === "PO").length}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">חוב פתוח</p>
          <p className="text-2xl font-bold text-foreground">${totalOwed.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">באיחור</p>
          <p className="text-2xl font-bold text-destructive flex items-center justify-center gap-1">
            {overdue > 0 && <AlertTriangle className="h-4 w-4" />}{overdue}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="documents" className="gap-1"><FileText className="h-4 w-4" />PI / PO ({docs.length})</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><CreditCard className="h-4 w-4" />תשלומים ({payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">סוג</th>
                <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
                <th className="text-right p-3 font-semibold text-foreground">כמות</th>
                <th className="text-right p-3 font-semibold text-foreground">מחיר כולל</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
                <th className="text-right p-3 font-semibold text-foreground">קובץ</th>
                <th className="text-right p-3 font-semibold text-foreground">פעולה</th>
              </tr></thead>
              <tbody className="divide-y">
                {filteredDocs.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">אין מסמכים</td></tr>
                ) : filteredDocs.map(doc => (
                  <tr key={doc.id} className="hover:bg-muted/30">
                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${doc.type === "PI" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>{doc.type}</span></td>
                    <td className="p-3 text-foreground">{supplierName(doc.supplier_id)}</td>
                    <td className="p-3 text-foreground">{productName(doc.product_id)}</td>
                    <td className="p-3 text-muted-foreground">{doc.quantity}</td>
                    <td className="p-3 text-muted-foreground font-mono" dir="ltr">{doc.total_price ? `${doc.total_price.toLocaleString()}` : "—"}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${docStatusColors[doc.status] || "bg-muted text-muted-foreground"}`}>{doc.status}</span></td>
                    <td className="p-3 text-muted-foreground text-xs">{format(new Date(doc.created_at), "dd/MM/yy")}</td>
                    <td className="p-3">{doc.file_url ? <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline">📎 צפה</a> : "—"}</td>
                    <td className="p-3">
                      {docStatusFlow.indexOf(doc.status) < docStatusFlow.length - 1 && (
                        <Button variant="outline" size="sm" onClick={() => advanceStatus(doc)}><ChevronLeft className="h-3 w-3 ml-1" />קדם</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                <th className="text-right p-3 font-semibold text-foreground">סכום</th>
                <th className="text-right p-3 font-semibold text-foreground">סוג</th>
                <th className="text-right p-3 font-semibold text-foreground">מועד פירעון</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                <th className="text-right p-3 font-semibold text-foreground">תאריך תשלום</th>
                <th className="text-right p-3 font-semibold text-foreground">פעולה</th>
              </tr></thead>
              <tbody className="divide-y">
                {filteredPayments.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">אין תשלומים</td></tr>
                ) : filteredPayments.map(p => {
                  const isOverdue = p.status !== "שולם" && p.due_date && isPast(new Date(p.due_date));
                  return (
                    <tr key={p.id} className={`hover:bg-muted/30 ${isOverdue ? "bg-destructive/5" : ""}`}>
                      <td className="p-3 font-medium text-foreground">{supplierName(p.supplier_id)}</td>
                      <td className="p-3 text-foreground font-mono" dir="ltr">{currencySymbol[p.currency] || ""}{p.amount.toLocaleString()}</td>
                      <td className="p-3 text-muted-foreground">{p.payment_type === "Deposit" ? "מקדמה" : p.payment_type === "Balance" ? "יתרה" : "מלא"}</td>
                      <td className="p-3 text-muted-foreground text-xs">{p.due_date ? format(new Date(p.due_date), "dd/MM/yy") : "—"}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payStatusColors[isOverdue ? "מאוחר" : p.status] || "bg-muted text-muted-foreground"}`}>{isOverdue ? "מאוחר" : p.status}</span></td>
                      <td className="p-3 text-muted-foreground text-xs">{p.paid_date ? format(new Date(p.paid_date), "dd/MM/yy") : "—"}</td>
                      <td className="p-3">
                        {p.status !== "שולם" && (
                          <Button variant="outline" size="sm" onClick={() => markPaid(p.id)}>סמן כשולם</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
