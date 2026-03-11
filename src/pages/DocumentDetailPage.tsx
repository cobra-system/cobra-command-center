import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData, useAuth } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InlineEditField } from "@/components/InlineEditField";
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
        <iframe src={url} className="w-full rounded-lg border" style={{ height: "70vh" }} title={filename || "PDF"} />
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" />פתח PDF בחלון חדש
        </a>
      </div>
    );
  }

  if (isOffice) {
    return (
      <div className="flex flex-col gap-2">
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
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

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/20">
      <FileText className="h-16 w-16 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{filename || "מסמך"}</p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 ml-1" />פתח / הורד קובץ</Button>
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
  const [uploading, setUploading] = useState(false);

  const fetchDoc = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from("purchase_documents").select("*").eq("id", id).single();
    if (data) setDoc(data as PurchaseDocument);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDoc(); }, [fetchDoc]);

  const handleFieldSave = async (field: string, rawValue: string) => {
    if (!doc) return;
    const updates: Record<string, any> = {};

    if (field === "quantity") {
      const qty = Number(rawValue) || 0;
      updates.quantity = qty;
      if (doc.unit_price) updates.total_price = qty * doc.unit_price;
    } else if (field === "unit_price") {
      const price = Number(rawValue) || null;
      updates.unit_price = price;
      updates.total_price = price ? (doc.quantity || 0) * price : null;
    } else {
      updates[field] = rawValue || null;
    }

    await supabase.from("purchase_documents").update(updates).eq("id", doc.id);
    toast.success("עודכן");
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
  const linkedOrder = orders.find(o => o.id === (doc as any).order_id);
  const linkedTask = tasks.find(t => t.id === (doc as any).task_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Details */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">
              פרטי מסמך
              {isManager && <span className="text-xs font-normal text-muted-foreground mr-2">לחץ פעמיים על שדה לעריכה</span>}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Type */}
                <InfoCell label="סוג">
                  {isManager ? (
                    <InlineEditField
                      value={doc.type}
                      onSave={v => handleFieldSave("type", v)}
                      options={[
                        { value: "PI", label: "PI — הצעת מחיר" },
                        { value: "PO", label: "PO — הזמנת רכש" },
                      ]}
                    />
                  ) : <p className="text-sm font-medium text-foreground">{doc.type}</p>}
                </InfoCell>

                {/* Currency */}
                <InfoCell label="מטבע">
                  {isManager ? (
                    <InlineEditField
                      value={doc.currency}
                      onSave={v => handleFieldSave("currency", v)}
                      options={[
                        { value: "USD", label: "USD $" },
                        { value: "EUR", label: "EUR €" },
                        { value: "ILS", label: "ILS ₪" },
                      ]}
                    />
                  ) : <p className="text-sm font-medium text-foreground">{doc.currency}</p>}
                </InfoCell>

                {/* Quantity */}
                <InfoCell label="כמות">
                  {isManager ? (
                    <InlineEditField value={doc.quantity?.toString() || ""} onSave={v => handleFieldSave("quantity", v)} type="number" />
                  ) : <p className="text-sm font-medium text-foreground">{doc.quantity ?? "—"}</p>}
                </InfoCell>

                {/* Unit price */}
                <InfoCell label="מחיר יחידה">
                  {isManager ? (
                    <InlineEditField value={doc.unit_price?.toString() || ""} onSave={v => handleFieldSave("unit_price", v)} type="number" />
                  ) : <p className="text-sm font-medium text-foreground">{doc.unit_price ? `${currencySymbol[doc.currency] || ""}${doc.unit_price}` : "—"}</p>}
                </InfoCell>

                {/* Total - read only */}
                <InfoCell label="סה״כ">
                  <p className="text-sm font-medium text-foreground">
                    {doc.total_price ? `${currencySymbol[doc.currency] || ""}${doc.total_price.toLocaleString()}` : "—"}
                  </p>
                </InfoCell>

                {/* Approval date - read only */}
                {doc.approval_date && (
                  <InfoCell label="תאריך אישור">
                    <p className="text-sm font-medium text-foreground">{format(new Date(doc.approval_date), "dd/MM/yyyy")}</p>
                  </InfoCell>
                )}
              </div>

              {/* Supplier */}
              <InfoCell label="ספק">
                {isManager ? (
                  <InlineEditField
                    value={doc.supplier_id || ""}
                    displayValue={supplierName || "—"}
                    onSave={v => handleFieldSave("supplier_id", v)}
                    options={[
                      { value: "", label: "ללא" },
                      ...suppliers.map(s => ({ value: s.id, label: s.company })),
                    ]}
                  />
                ) : (
                  supplierName ? (
                    <button onClick={() => navigate(`/suppliers/${doc.supplier_id}`)} className="text-sm font-medium text-primary hover:underline">{supplierName}</button>
                  ) : <p className="text-sm text-muted-foreground">—</p>
                )}
              </InfoCell>

              {/* Product */}
              <InfoCell label="מוצר">
                {isManager ? (
                  <InlineEditField
                    value={doc.product_id || ""}
                    displayValue={productName || "—"}
                    onSave={v => handleFieldSave("product_id", v)}
                    options={[
                      { value: "", label: "ללא" },
                      ...products.map(p => ({ value: p.id, label: p.name })),
                    ]}
                  />
                ) : (
                  productName ? (
                    <button onClick={() => navigate(`/products/${doc.product_id}`)} className="text-sm font-medium text-primary hover:underline">{productName}</button>
                  ) : <p className="text-sm text-muted-foreground">—</p>
                )}
              </InfoCell>

              {/* Linked order */}
              <InfoCell label="הזמנה מקושרת">
                {isManager ? (
                  <InlineEditField
                    value={(doc as any).order_id || ""}
                    displayValue={linkedOrder ? `${linkedOrder.supplier_name || ""} — ${linkedOrder.items?.map((i: any) => i.name).join(", ")}` : "—"}
                    onSave={v => handleFieldSave("order_id", v)}
                    options={[
                      { value: "", label: "ללא" },
                      ...orders.map(o => ({ value: o.id, label: `${o.supplier_name || o.id.slice(0, 8)} — ${o.items?.map((i: any) => i.name).join(", ")}` })),
                    ]}
                  />
                ) : (
                  linkedOrder ? (
                    <button onClick={() => navigate(`/orders/${linkedOrder.id}`)} className="text-sm font-medium text-primary hover:underline">
                      {linkedOrder.supplier_name} — {linkedOrder.items?.map((i: any) => i.name).join(", ")}
                    </button>
                  ) : <p className="text-sm text-muted-foreground">—</p>
                )}
              </InfoCell>

              {/* Linked task */}
              <InfoCell label="משימה מקושרת">
                {isManager ? (
                  <InlineEditField
                    value={(doc as any).task_id || ""}
                    displayValue={linkedTask?.title || "—"}
                    onSave={v => handleFieldSave("task_id", v)}
                    options={[
                      { value: "", label: "ללא" },
                      ...tasks.map(t => ({ value: t.id, label: t.title })),
                    ]}
                  />
                ) : (
                  linkedTask ? (
                    <button onClick={() => navigate("/tasks")} className="text-sm font-medium text-primary hover:underline">{linkedTask.title}</button>
                  ) : <p className="text-sm text-muted-foreground">—</p>
                )}
              </InfoCell>

              {/* Notes */}
              <InfoCell label="הערות">
                {isManager ? (
                  <InlineEditField
                    value={doc.notes || ""}
                    onSave={v => handleFieldSave("notes", v)}
                    displayValue={doc.notes ? <span className="whitespace-pre-wrap">{doc.notes}</span> : <span className="text-muted-foreground">לחץ פעמיים להוספת הערה</span>}
                  />
                ) : (
                  doc.notes ? <p className="text-sm text-foreground whitespace-pre-wrap">{doc.notes}</p> : <p className="text-sm text-muted-foreground">—</p>
                )}
              </InfoCell>
            </div>
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
              {isManager && <p className="text-xs">העלה קובץ מהעמודה השמאלית</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}
