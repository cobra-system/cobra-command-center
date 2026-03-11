import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData, useAuth } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowRight, FileText, Upload, ExternalLink, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PurchaseDocument {
  id: string;
  type: string;
  supplier_id: string | null;
  product_id: string | null;
  order_id: string | null;
  task_id: string | null;
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

const docStatusFlow = ["ממתין לאישור", "אושר", "נשלח לספק", "בוצע"];
const docStatusColors: Record<string, string> = {
  "ממתין לאישור": "bg-warning/15 text-warning",
  "אושר": "bg-primary/15 text-primary",
  "נשלח לספק": "bg-accent/15 text-accent",
  "בוצע": "bg-success/15 text-success",
};
const currencySymbol: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪" };

function FilePreview({ url, filename }: { url: string; filename?: string }) {
  const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isPdf = ext === "pdf";
  const isOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
  const isText = ["txt", "csv", "json"].includes(ext);

  if (isImage) {
    return (
      <div className="flex flex-col items-center gap-2">
        <img src={url} alt={filename || "document"} className="max-w-full max-h-[70vh] rounded-lg border shadow object-contain" />
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" />פתח בחלון חדש
        </a>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="flex flex-col gap-2">
        <iframe
          src={url}
          className="w-full rounded-lg border"
          style={{ height: "70vh" }}
          title={filename || "PDF"}
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" />פתח PDF בחלון חדש
        </a>
      </div>
    );
  }

  if (isOffice) {
    const encodedUrl = encodeURIComponent(url);
    return (
      <div className="flex flex-col gap-2">
        <iframe
          src={`https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`}
          className="w-full rounded-lg border"
          style={{ height: "70vh" }}
          title={filename || "document"}
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" />הורד קובץ
        </a>
      </div>
    );
  }

  // Fallback for unknown types
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/20">
      <FileText className="h-16 w-16 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{filename || "מסמך"}</p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <ExternalLink className="h-4 w-4 ml-1" />פתח / הורד קובץ
        </Button>
      </a>
    </div>
  );
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { suppliers, products, orders, tasks } = useData();
  const { currentUser } = useAuth();
  const isManager = currentUser?.role === "MANAGER";

  const [doc, setDoc] = useState<PurchaseDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Edit state
  const [editType, setEditType] = useState("PI");
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editProductId, setEditProductId] = useState("");
  const [editOrderId, setEditOrderId] = useState("");
  const [editTaskId, setEditTaskId] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editNotes, setEditNotes] = useState("");
  const [editing, setEditing] = useState(false);

  const fetchDoc = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from("purchase_documents").select("*").eq("id", id).single();
    if (data) {
      const d = data as PurchaseDocument;
      setDoc(d);
      setEditType(d.type);
      setEditSupplierId(d.supplier_id || "");
      setEditProductId(d.product_id || "");
      setEditOrderId((d as any).order_id || "");
      setEditTaskId((d as any).task_id || "");
      setEditQty(d.quantity?.toString() || "");
      setEditUnitPrice(d.unit_price?.toString() || "");
      setEditCurrency(d.currency || "USD");
      setEditNotes(d.notes || "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDoc(); }, [fetchDoc]);

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    const qty = Number(editQty) || 0;
    const unitPrice = Number(editUnitPrice) || null;
    const updates: Record<string, any> = {
      type: editType,
      supplier_id: editSupplierId || null,
      product_id: editProductId || null,
      quantity: qty,
      unit_price: unitPrice,
      total_price: unitPrice ? qty * unitPrice : null,
      currency: editCurrency,
      notes: editNotes || null,
    };
    // Try to set order_id and task_id if columns exist
    if (editOrderId) updates.order_id = editOrderId;
    if (editTaskId) updates.task_id = editTaskId;
    await supabase.from("purchase_documents").update(updates).eq("id", doc.id);
    toast.success("מסמך עודכן");
    setSaving(false);
    setEditing(false);
    fetchDoc();
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!doc) return;
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "אושר") {
      updates.approval_date = new Date().toISOString();
      updates.approved_by = currentUser?.id;
    }
    await supabase.from("purchase_documents").update(updates).eq("id", doc.id);
    toast.success(`סטטוס → ${newStatus}`);
    fetchDoc();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doc) return;
    setUploading(true);
    const path = `uploads/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) { toast.error("שגיאה בהעלאה"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    await supabase.from("purchase_documents").update({ file_url: urlData.publicUrl }).eq("id", doc.id);
    toast.success("קובץ הועלה");
    setUploading(false);
    fetchDoc();
  };

  const handleRemoveFile = async () => {
    if (!doc) return;
    await supabase.from("purchase_documents").update({ file_url: null }).eq("id", doc.id);
    toast.success("קובץ הוסר");
    fetchDoc();
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!doc) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-muted-foreground">מסמך לא נמצא</p>
      <Button variant="outline" onClick={() => navigate("/documents")}><ArrowRight className="h-4 w-4 ml-1" />חזרה</Button>
    </div>
  );

  const supplierName = suppliers.find(s => s.id === doc.supplier_id)?.company;
  const productName = products.find(p => p.id === doc.product_id)?.name;
  const supplierId = suppliers.find(s => s.id === doc.supplier_id)?.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded text-sm font-bold ${doc.type === "PI" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
              {doc.type}
            </span>
            <h1 className="text-xl font-bold text-foreground">
              {supplierName || "ספק לא ידוע"} — {productName || "מוצר לא ידוע"}
            </h1>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn("px-3 py-1 rounded-full text-xs font-medium cursor-pointer", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                  {doc.status}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1" align="start">
                <div className="flex flex-col gap-0.5">
                  {docStatusFlow.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", doc.status === s && "bg-muted")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground mt-1">נוצר: {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</p>
        </div>
        {isManager && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>✏️ עריכה</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Details / Edit */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">פרטי מסמך</h2>
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">סוג</Label>
                    <Select value={editType} onValueChange={setEditType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PI">PI — הצעת מחיר</SelectItem>
                        <SelectItem value="PO">PO — הזמנת רכש</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">מטבע</Label>
                    <Select value={editCurrency} onValueChange={setEditCurrency}>
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
                  <Label className="text-xs">ספק</Label>
                  <Select value={editSupplierId || "none"} onValueChange={v => setEditSupplierId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">מוצר</Label>
                  <Select value={editProductId || "none"} onValueChange={v => setEditProductId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="בחר מוצר" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">הזמנה מקושרת</Label>
                  <Select value={editOrderId || "none"} onValueChange={v => setEditOrderId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="בחר הזמנה" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {orders.map(o => <SelectItem key={o.id} value={o.id}>{o.supplier_name || o.id.slice(0, 8)} — {o.items?.map(i => i.name).join(", ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">משימה מקושרת</Label>
                  <Select value={editTaskId || "none"} onValueChange={v => setEditTaskId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="בחר משימה" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">כמות</Label><Input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">מחיר יחידה</Label><Input type="number" value={editUnitPrice} onChange={e => setEditUnitPrice(e.target.value)} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">הערות</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} /></div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}שמור
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">ביטול</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="ספק" value={supplierName} onClick={supplierId ? () => navigate(`/suppliers/${supplierId}`) : undefined} />
                  <InfoRow label="מוצר" value={productName} onClick={doc.product_id ? () => navigate(`/products/${doc.product_id}`) : undefined} />
                  <InfoRow label="כמות" value={doc.quantity?.toString()} />
                  <InfoRow label="מחיר יחידה" value={doc.unit_price ? `${currencySymbol[doc.currency] || ""}${doc.unit_price}` : undefined} />
                  <InfoRow label="סה״כ" value={doc.total_price ? `${currencySymbol[doc.currency] || ""}${doc.total_price.toLocaleString()}` : undefined} />
                  <InfoRow label="מטבע" value={doc.currency} />
                  {doc.approval_date && <InfoRow label="תאריך אישור" value={format(new Date(doc.approval_date), "dd/MM/yyyy")} />}
                </div>
                {doc.notes && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">הערות</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{doc.notes}</p>
                  </div>
                )}

                {/* Linked entities */}
                {(editOrderId || editTaskId) && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold text-foreground">קישורים</p>
                    {editOrderId && (
                      <button onClick={() => navigate(`/orders/${editOrderId}`)} className="text-xs text-primary hover:underline block">
                        → הזמנה מקושרת
                      </button>
                    )}
                    {editTaskId && (
                      <button onClick={() => navigate(`/tasks?highlight=${editTaskId}`)} className="text-xs text-primary hover:underline block">
                        → משימה מקושרת
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* File upload section */}
          {isManager && (
            <div className="bg-card rounded-xl border shadow-sm p-5">
              <h2 className="text-base font-semibold text-foreground mb-3">קובץ מצורף</h2>
              {doc.file_url ? (
                <div className="flex items-center gap-2">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" />פתח קובץ
                  </a>
                  <Button variant="ghost" size="sm" onClick={handleRemoveFile} className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4 ml-1" />הסר
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">{uploading ? "מעלה..." : "העלה קובץ (PDF, Word, Excel, תמונה)"}</span>
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Right: File preview */}
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">תצוגה מקדימה</h2>
          {doc.file_url ? (
            <FilePreview url={doc.file_url} filename={doc.file_url.split("/").pop()} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground border rounded-lg bg-muted/10">
              <FileText className="h-16 w-16 opacity-30" />
              <p className="text-sm">אין קובץ מצורף</p>
              {isManager && (
                <p className="text-xs">העלה קובץ מהעמודה השמאלית</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, onClick }: { label: string; value?: string | null; onClick?: () => void }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {value ? (
        onClick ? (
          <button onClick={onClick} className="text-sm font-medium text-primary hover:underline">{value}</button>
        ) : (
          <p className="text-sm font-medium text-foreground">{value}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}
