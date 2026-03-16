import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData, useAuth } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InlineEditField } from "@/components/InlineEditField";
import { ArrowRight, FileText, Upload, ExternalLink, X, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import type { Payment } from "@/components/documents/types";
import { docStatusFlow, docStatusColors, currencySymbol, payStatusColors, paymentTypeLabels } from "@/components/documents/constants";

interface PurchaseDocument {
  id: string;
  type: string;
  document_name: string | null;
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

function FilePreview({ url, filename }: { url: string; filename?: string }) {
  const [urlValid, setUrlValid] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then(res => { if (!cancelled) setUrlValid(res.ok); })
      .catch(() => { if (!cancelled) setUrlValid(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (urlValid === false) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/20">
        <FileText className="h-16 w-16 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">הקובץ אינו זמין</p>
        <p className="text-xs text-muted-foreground">יתכן שהקובץ נמחק או שהקישור אינו תקין</p>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 ml-1" />נסה לפתוח ישירות</Button>
        </a>
      </div>
    );
  }

  const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isPdf = ext === "pdf";
  const isOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);

  if (urlValid === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

  const [doc, setDoc] = useState<PurchaseDocument | null>(null);
  const [linkedPayments, setLinkedPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDoc = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const docRes = await supabase.from("purchase_documents").select("*").eq("id", id).single();
    if (docRes.data) setDoc(docRes.data as unknown as PurchaseDocument);
    // Payments linked by order_id if available
    const orderIdVal = (docRes.data as any)?.order_id;
    if (orderIdVal) {
      const paysRes = await supabase.from("supplier_payments").select("*").eq("order_id", orderIdVal).order("created_at", { ascending: false });
      if (paysRes.data) setLinkedPayments(paysRes.data as unknown as Payment[]);
    }
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
  const currentStepIdx = docStatusFlow.indexOf(doc.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-3 py-1 rounded text-sm font-bold ${doc.type === "PI" ? "bg-primary/15 text-primary" : doc.type === "PO" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                {doc.type}
              </span>
              <h1 className="text-xl font-bold text-foreground">
                {doc.document_name || supplierName || "מסמך"} {productName ? `— ${productName}` : ""}
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
              <span className="text-xs font-normal text-muted-foreground mr-2">לחץ פעמיים על שדה לעריכה</span>
            </h2>
            <div className="space-y-3">
              {/* Document name */}
              <InfoCell label="שם מסמך">
                <InlineEditField
                  value={doc.document_name || ""}
                  onSave={v => handleFieldSave("document_name", v)}
                  displayValue={doc.document_name || <span className="text-muted-foreground">לחץ פעמיים להוספת שם</span>}
                />
              </InfoCell>
              <div className="grid grid-cols-2 gap-3">
                {/* Type */}
                <InfoCell label="סוג">
                  <InlineEditField
                    value={doc.type}
                    onSave={v => handleFieldSave("type", v)}
                    options={[
                      { value: "PI", label: "PI — הצעת מחיר" },
                      { value: "PO", label: "PO — הזמנת רכש" },
                    ]}
                  />
                </InfoCell>

                {/* Currency */}
                <InfoCell label="מטבע">
                  <InlineEditField
                    value={doc.currency}
                    onSave={v => handleFieldSave("currency", v)}
                    options={[
                      { value: "USD", label: "USD $" },
                      { value: "EUR", label: "EUR €" },
                      { value: "ILS", label: "ILS ₪" },
                    ]}
                  />
                </InfoCell>

                {/* Quantity */}
                <InfoCell label="כמות">
                  <InlineEditField value={doc.quantity?.toString() || ""} onSave={v => handleFieldSave("quantity", v)} type="number" />
                </InfoCell>

                {/* Unit price */}
                <InfoCell label="מחיר יחידה">
                  <InlineEditField value={doc.unit_price?.toString() || ""} onSave={v => handleFieldSave("unit_price", v)} type="number" />
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
                <InlineEditField
                  value={doc.supplier_id || ""}
                  displayValue={supplierName || "—"}
                  onSave={v => handleFieldSave("supplier_id", v)}
                  options={[
                    { value: "", label: "ללא" },
                    ...suppliers.map(s => ({ value: s.id, label: s.company })),
                  ]}
                />
              </InfoCell>

              {/* Product */}
              <InfoCell label="מוצר">
                <InlineEditField
                  value={doc.product_id || ""}
                  displayValue={productName || "—"}
                  onSave={v => handleFieldSave("product_id", v)}
                  options={[
                    { value: "", label: "ללא" },
                    ...products.map(p => ({ value: p.id, label: p.name })),
                  ]}
                />
              </InfoCell>

              {/* Linked order */}
              <InfoCell label="הזמנה מקושרת">
                <InlineEditField
                  value={(doc as any).order_id || ""}
                  displayValue={linkedOrder ? `${linkedOrder.supplier_name || ""} — ${linkedOrder.items?.map((i: any) => i.name).join(", ")}` : "—"}
                  onSave={v => handleFieldSave("order_id", v)}
                  options={[
                    { value: "", label: "ללא" },
                    ...orders.map(o => ({ value: o.id, label: `${o.supplier_name || o.id.slice(0, 8)} — ${o.items?.map((i: any) => i.name).join(", ")}` })),
                  ]}
                />
              </InfoCell>

              {/* Linked task */}
              <InfoCell label="משימה מקושרת">
                <InlineEditField
                  value={(doc as any).task_id || ""}
                  displayValue={linkedTask?.title || "—"}
                  onSave={v => handleFieldSave("task_id", v)}
                  options={[
                    { value: "", label: "ללא" },
                    ...tasks.map(t => ({ value: t.id, label: t.title })),
                  ]}
                />
              </InfoCell>

              {/* Notes */}
              <InfoCell label="הערות">
                <InlineEditField
                  value={doc.notes || ""}
                  onSave={v => handleFieldSave("notes", v)}
                  displayValue={doc.notes ? <span className="whitespace-pre-wrap">{doc.notes}</span> : <span className="text-muted-foreground">לחץ פעמיים להוספת הערה</span>}
                />
              </InfoCell>
            </div>
          </div>

          {/* File upload section */}
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
              <p className="text-xs">העלה קובץ מהעמודה השמאלית</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">מצב מסמך</h2>
          {currentStepIdx >= 0 && currentStepIdx < docStatusFlow.length - 1 && (
            <Button size="sm" onClick={() => handleStatusChange(docStatusFlow[currentStepIdx + 1])}>
              <Check className="h-4 w-4 ml-1" />קדם ל: {docStatusFlow[currentStepIdx + 1]}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {docStatusFlow.map((step, i) => {
            const isActive = i <= currentStepIdx;
            const isCurrent = i === currentStepIdx;
            return (
              <div key={step} className="flex-1">
                <div className={cn(
                  "text-center py-2 px-1 rounded-lg text-xs font-medium border transition-colors",
                  isCurrent ? `${docStatusColors[step]} border-current` : isActive ? "bg-muted text-foreground border-transparent" : "bg-muted/30 text-muted-foreground border-transparent"
                )}>
                  {step}
                </div>
              </div>
            );
          })}
        </div>
        {doc.approval_date && (
          <p className="text-xs text-muted-foreground mt-3">אושר ב-{format(new Date(doc.approval_date), "dd/MM/yyyy")}</p>
        )}
      </div>

      {/* Linked Payments */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">תשלומים מקושרים ({linkedPayments.length})</h2>
        {linkedPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">אין תשלומים מקושרים למסמך זה</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">סכום</th>
                <th className="text-right p-3 font-semibold text-foreground">סוג</th>
                <th className="text-right p-3 font-semibold text-foreground">מועד פירעון</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                <th className="text-right p-3 font-semibold text-foreground">פעולה</th>
              </tr></thead>
              <tbody className="divide-y">
                {linkedPayments.map(p => {
                  const isOverdue = p.status !== "שולם" && p.due_date && isPast(new Date(p.due_date));
                  const displayStatus = isOverdue ? "מאוחר" : p.status;
                  return (
                    <tr key={p.id} className={isOverdue ? "bg-destructive/5" : ""}>
                      <td className="p-3 font-mono" dir="ltr">{currencySymbol[p.currency] || ""}{p.amount.toLocaleString()}</td>
                      <td className="p-3 text-muted-foreground">{paymentTypeLabels[p.payment_type] || p.payment_type}</td>
                      <td className="p-3 text-muted-foreground text-xs">{p.due_date ? format(new Date(p.due_date), "dd/MM/yy") : "—"}</td>
                      <td className="p-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", payStatusColors[displayStatus] || "bg-muted text-muted-foreground")}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        {p.status !== "שולם" && (
                          <Button variant="outline" size="sm" onClick={async () => {
                            await supabase.from("supplier_payments").update({ status: "שולם", paid_date: new Date().toISOString().split("T")[0] }).eq("id", p.id);
                            toast.success("סומן כשולם");
                            fetchDoc();
                          }}>סמן כשולם</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
