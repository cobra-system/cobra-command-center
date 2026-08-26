import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { FileText, ExternalLink, Upload, CreditCard, AlertTriangle, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth, useCurrency } from "@/contexts/AppContext";
import { canSeeDocuments } from "@/lib/permissions";
import type { PurchaseDocument, Payment } from "@/components/documents/types";
import { docStatusFlow, docStatusColors, payStatusColors, currencySymbol, paymentTypeLabels } from "@/components/documents/constants";
import { DocSubtypeBadge } from "@/components/documents/DocStatusBadge";
import SimpleFileUploadDialog from "@/components/documents/SimpleFileUploadDialog";

interface Props {
  supplierId?: string;
  productId?: string;
  orderId?: string;
}

const docTypes = ["PI", "PO", "כללי"] as const;

export default function DocumentsSection({ supplierId, productId, orderId }: Props) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { formatPrice } = useCurrency();
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const allowed = canSeeDocuments(currentUser);

  const fetchData = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    setLoading(true);

    const baseQuery = supabase.from("purchase_documents").select("*");
    const filtered = supplierId ? baseQuery.eq("supplier_id", supplierId)
      : productId ? baseQuery.eq("product_id", productId)
      : orderId ? baseQuery.eq("order_id", orderId)
      : baseQuery;
    const { data: docData } = await filtered.order("created_at", { ascending: false });
    if (docData) setDocs(docData as PurchaseDocument[]);

    if (supplierId) {
      const { data: payData } = await supabase.from("supplier_payments").select("*").eq("supplier_id", supplierId).order("created_at", { ascending: false });
      if (payData) setPayments(payData as Payment[]);
    }

    setLoading(false);
  }, [supplierId, productId, orderId, allowed]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!allowed) return null;

  const handleDocStatusChange = async (docId: string, newStatus: string) => {
    const updates: Record<string, string | null | undefined> = { status: newStatus };
    if (newStatus === "אושר") {
      updates.approval_date = new Date().toISOString();
      updates.approved_by = currentUser?.id;
    }
    await supabase.from("purchase_documents").update(updates).eq("id", docId);
    fetchData();
  };

  const handleDocTypeChange = async (docId: string, newType: string) => {
    await supabase.from("purchase_documents").update({ type: newType }).eq("id", docId);
    fetchData();
  };

  if (loading) return null;

  return (
    <>
      {/* Documents Section */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">מסמכים ({docs.length})</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="h-3.5 w-3.5 ml-1" />העלה מסמך
          </Button>
        </div>
        <SimpleFileUploadDialog
          open={showUpload}
          onOpenChange={setShowUpload}
          onSaved={fetchData}
          defaultSupplierId={supplierId}
          defaultProductId={productId}
          defaultOrderId={orderId}
        />
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">אין מסמכים משויכים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">שם</th>
                <th className="text-right p-3 font-semibold text-foreground">סוג</th>
                <th className="text-right p-3 font-semibold text-foreground">סה"כ</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
              </tr></thead>
              <tbody className="divide-y">
                {docs.map(doc => (
                  <tr
                    key={doc.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <td className="p-3 text-foreground">
                      <div className="flex items-center gap-1.5">
                        {doc.file_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                        <span>{doc.document_name || doc.notes || "ללא שם"}</span>
                        <DocSubtypeBadge type={doc.type} subtype={doc.document_subtype} />
                      </div>
                    </td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={cn("px-2 py-0.5 rounded text-xs font-bold cursor-pointer", doc.type === "PI" ? "bg-primary/15 text-primary" : doc.type === "PO" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground")}>
                            {doc.type}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1" align="start">
                          <div className="flex flex-col gap-0.5">
                            {docTypes.map(t => (
                              <button
                                key={t}
                                onClick={() => handleDocTypeChange(doc.id, t)}
                                className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", doc.type === t && "bg-muted")}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono" dir="ltr">
                      {doc.total_price ? formatPrice(doc.total_price, doc.currency) : "—"}
                    </td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={cn("px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                            {doc.status}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1" align="start">
                          <div className="flex flex-col gap-0.5">
                            {docStatusFlow.map(s => (
                              <button
                                key={s}
                                onClick={() => handleDocStatusChange(doc.id, s)}
                                className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", doc.status === s && "bg-muted")}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{format(new Date(doc.created_at), "dd/MM/yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments Section (only for supplier context) */}
      {supplierId && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">תשלומים ({payments.length})</h2>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">אין תשלומים לספק זה</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold text-foreground">סכום</th>
                  <th className="text-right p-3 font-semibold text-foreground">סוג</th>
                  <th className="text-right p-3 font-semibold text-foreground">מועד פירעון</th>
                  <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                </tr></thead>
                <tbody className="divide-y">
                  {payments.map(p => {
                    const isOverdue = p.status !== "שולם" && p.due_date && isPast(new Date(p.due_date));
                    const displayStatus = isOverdue ? "מאוחר" : p.status;
                    return (
                      <tr key={p.id} className={isOverdue ? "bg-destructive/5" : ""}>
                        <td className="p-3 font-mono" dir="ltr">{formatPrice(p.amount, p.currency)}</td>
                        <td className="p-3 text-muted-foreground">{paymentTypeLabels[p.payment_type] || p.payment_type}</td>
                        <td className="p-3 text-muted-foreground text-xs">{p.due_date ? format(new Date(p.due_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="p-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", payStatusColors[displayStatus] || "bg-muted text-muted-foreground")}>
                            {displayStatus}
                          </span>
                          {isOverdue && <AlertTriangle className="h-3 w-3 text-destructive inline ml-1" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
