import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { useParams, useNavigate } from "react-router-dom";
import { useData, useAuth } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InlineEditField } from "@/components/InlineEditField";
import { ArrowRight, FileText, Upload, ExternalLink, X, Loader2, Check, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import type { Payment } from "@/components/documents/types";
import { docStatusFlow, docStatusColors, currencySymbol, payStatusColors, paymentTypeLabels } from "@/components/documents/constants";
import html2pdf from "html2pdf.js";
import { usePermissions } from "@/hooks/usePermissions";
import DocumentProductSelector from "@/components/documents/DocumentProductSelector";

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
  const [excelHtml, setExcelHtml] = useState<string | null>(null);
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState(false);

  const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isPdf = ext === "pdf";
  const isExcel = ["xls", "xlsx", "csv"].includes(ext);
  const isWord = ["doc", "docx"].includes(ext);
  const isPpt = ["ppt", "pptx"].includes(ext);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then(res => { if (!cancelled) setUrlValid(res.ok); })
      .catch(() => { if (!cancelled) setUrlValid(false); });
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!urlValid || (!isExcel && !isWord)) return;
    let cancelled = false;
    setDocLoading(true);
    setDocError(false);

    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => {
        if (cancelled) return;
        if (isExcel) {
          const wb = XLSX.read(buf, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const html = XLSX.utils.sheet_to_html(ws);
          if (!cancelled) setExcelHtml(html);
        } else if (isWord) {
          return mammoth.convertToHtml({ arrayBuffer: buf }).then(result => {
            if (!cancelled) setWordHtml(result.value);
          });
        }
      })
      .catch(() => { if (!cancelled) setDocError(true); })
      .finally(() => { if (!cancelled) setDocLoading(false); });

    return () => { cancelled = true; };
  }, [url, urlValid, isExcel, isWord]);

  if (urlValid === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

  if (isExcel) {
    if (docLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (docError || !excelHtml) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/20">
          <FileText className="h-16 w-16 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">לא ניתן להציג את הקובץ</p>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 ml-1" />הורד קובץ</Button>
          </a>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <style>{`
          .excel-preview table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
          .excel-preview td, .excel-preview th { border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; white-space: nowrap; }
          .excel-preview tr:nth-child(even) { background: #f8fafc; }
          .excel-preview tr:first-child td, .excel-preview tr:first-child th { background: #f1f5f9; font-weight: 600; }
        `}</style>
        <div
          className="excel-preview w-full rounded-lg border overflow-auto bg-white"
          style={{ maxHeight: "70vh" }}
          dangerouslySetInnerHTML={{ __html: excelHtml }}
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" />הורד קובץ אקסל
        </a>
      </div>
    );
  }

  if (isWord) {
    if (docLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (docError || !wordHtml) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg bg-muted/20">
          <FileText className="h-16 w-16 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">לא ניתן להציג את הקובץ</p>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 ml-1" />הורד קובץ</Button>
          </a>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <div
          className="w-full rounded-lg border bg-white p-6 overflow-auto prose prose-sm max-w-none"
          style={{ maxHeight: "70vh", direction: "ltr" }}
          dangerouslySetInnerHTML={{ __html: wordHtml }}
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" />הורד קובץ וורד
        </a>
      </div>
    );
  }

  if (isPpt) {
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

function generateDocumentPDF(
  doc: PurchaseDocument,
  supplierName: string | undefined,
  productName: string | undefined
) {
  const element = document.createElement("div");
  element.style.padding = "20px";
  element.style.fontFamily = "Arial, sans-serif";
  element.style.lineHeight = "1.6";
  element.style.direction = "rtl";

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null || amount === undefined) return "—";
    return `${currencySymbol[currency] || currency} ${amount.toLocaleString()}`;
  };

  element.innerHTML = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">מסמך רכש</h1>
      <p style="margin: 5px 0; color: #666; font-size: 14px;">${doc.document_name || "מסמך"}</p>
    </div>

    <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div>
          <p style="margin: 0; color: #666; font-size: 12px; font-weight: bold;">סוג מסמך</p>
          <p style="margin: 5px 0; font-size: 14px; font-weight: bold;">${doc.type}</p>
        </div>
        <div>
          <p style="margin: 0; color: #666; font-size: 12px; font-weight: bold;">סטטוס</p>
          <p style="margin: 5px 0; font-size: 14px; font-weight: bold;">${doc.status}</p>
        </div>
        <div>
          <p style="margin: 0; color: #666; font-size: 12px; font-weight: bold;">מטבע</p>
          <p style="margin: 5px 0; font-size: 14px;">${doc.currency}</p>
        </div>
        <div>
          <p style="margin: 0; color: #666; font-size: 12px; font-weight: bold;">תאריך יצירה</p>
          <p style="margin: 5px 0; font-size: 14px;">${format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</p>
        </div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 10px;">פרטי מסמך</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; text-align: right;">שם מסמך</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${doc.document_name || "—"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; text-align: right;">ספק</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${supplierName || "—"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; text-align: right;">מוצר</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${productName || "—"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; text-align: right;">כמות</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${doc.quantity || "—"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; text-align: right;">מחיר יחידה</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(doc.unit_price, doc.currency)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 2px solid #333; font-weight: bold; text-align: right;">סה״כ</td>
          <td style="padding: 8px; border-bottom: 2px solid #333; text-align: right; font-weight: bold; font-size: 16px;">${formatCurrency(doc.total_price, doc.currency)}</td>
        </tr>
      </table>
    </div>

    ${doc.approval_date ? `
      <div style="margin-bottom: 20px; padding: 10px; background-color: #e8f5e9; border-left: 4px solid #4caf50;">
        <p style="margin: 0; font-size: 12px; color: #666;">אושר ב-${format(new Date(doc.approval_date), "dd/MM/yyyy")}</p>
      </div>
    ` : ""}

    ${doc.notes ? `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">הערות</h3>
        <p style="margin: 0; padding: 10px; background-color: #fff3cd; border-radius: 3px; font-size: 13px; white-space: pre-wrap;">${doc.notes}</p>
      </div>
    ` : ""}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 11px;">
      <p style="margin: 0;">מסמך זה נוצר באופן אוטומטי ב-${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
    </div>
  `;

  const filename = `${doc.document_name || "document"}-${doc.type}-${format(new Date(doc.created_at), "yyyy-MM-dd")}.pdf`;
  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
  };

  html2pdf().set(opt).from(element).save();
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { suppliers, products, orders } = useData();
  const { currentUser } = useAuth();

  const [doc, setDoc] = useState<PurchaseDocument | null>(null);
  const [linkedPayments, setLinkedPayments] = useState<Payment[]>([]);
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { hasEdit } = usePermissions("documents");

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
    // Fetch linked products from document_products junction table
    if (docRes.data?.id) {
      const productsRes = await supabase
        .from("document_products")
        .select("product_id")
        .eq("document_id", docRes.data.id)
        .order("created_at", { ascending: true });
      if (productsRes.data) {
        setLinkedProductIds(productsRes.data.map(row => (row as any).product_id));
      }
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

    // Sanitize filename: replace spaces and special chars with underscores
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_");

    const path = `uploads/${Date.now()}_${sanitizedName}`;
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !doc) return;

    setUploading(true);
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_");

    const path = `uploads/${Date.now()}_${sanitizedName}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) {
      toast.error("שגיאה בהעלאה");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    await supabase.from("purchase_documents").update({ file_url: urlData.publicUrl }).eq("id", doc.id);
    toast.success("קובץ הועלה");
    setUploading(false);
    fetchDoc();
  }, [doc, fetchDoc]);

  const handleDownloadFile = async () => {
    if (!doc?.file_url) return;
    try {
      const filename = doc.file_url.split("/").pop() || "file";
      const a = document.createElement("a");
      a.href = doc.file_url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("הקובץ מורד");
    } catch (err) {
      toast.error("שגיאה בהורדת הקובץ");
      console.error(err);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!doc) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-muted-foreground">מסמך לא נמצא</p>
      <Button variant="outline" onClick={() => navigate("/documents")} data-navigate-to="/documents"><ArrowRight className="h-4 w-4 ml-1" />חזרה</Button>
    </div>
  );

  const supplierName = suppliers.find(s => s.id === doc.supplier_id)?.company;
  const productName = products.find(p => p.id === doc.product_id)?.name;
  const linkedOrder = orders.find(o => o.id === (doc as any).order_id);
  const currentStepIdx = docStatusFlow.indexOf(doc.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-navigate-to="/documents">
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
            {hasEdit ? (
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
            ) : (
              <span className={cn("px-3 py-1 rounded-full text-xs font-medium", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                {doc.status}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateDocumentPDF(doc, supplierName, productName)}
            >
              <Download className="h-4 w-4 ml-1" />הורד כ PDF
            </Button>
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
                      { value: "כללי", label: "כללי" },
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
              <InfoCell label="מוצר (ראשי)">
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

              {/* Multiple products selector */}
              <div className="col-span-2">
                {hasEdit ? (
                  <DocumentProductSelector
                    documentId={doc.id}
                    linkedProductIds={linkedProductIds}
                    onProductsUpdated={setLinkedProductIds}
                  />
                ) : linkedProductIds.length > 0 ? (
                  <div>
                    <label className="text-sm font-medium">מוצרים מקושרים נוספים</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {linkedProductIds.map(pid => {
                        const p = products.find(prod => prod.id === pid);
                        return p ? (
                          <span key={pid} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
                            {p.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

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
              <div className="flex items-center gap-2 flex-wrap">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ExternalLink className="h-4 w-4" />פתח קובץ
                </a>
                <Button variant="ghost" size="sm" onClick={handleDownloadFile} className="text-primary hover:text-primary">
                  <Download className="h-4 w-4 ml-1" />הורד
                </Button>
                {hasEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4 ml-1" />מחק
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogTitle>מחיקת קובץ</AlertDialogTitle>
                      <AlertDialogDescription>
                        האם אתה בטוח שברצונך למחוק את הקובץ המצורף? פעולה זו לא ניתנת לביטול.
                      </AlertDialogDescription>
                      <div className="flex gap-2 justify-end">
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRemoveFile}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          מחק
                        </AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ) : hasEdit ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/30"
                )}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">{uploading ? "מעלה..." : "גרור קובץ או לחץ להעלאה (PDF, Word, Excel, תמונה)"}</span>
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">אין קובץ מצורף</p>
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
          {hasEdit && currentStepIdx >= 0 && currentStepIdx < docStatusFlow.length - 1 && (
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
                        {hasEdit && p.status !== "שולם" && (
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
