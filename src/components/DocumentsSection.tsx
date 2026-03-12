import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ExternalLink, Plus, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import type { PurchaseDocument, Payment } from "@/components/documents/types";
import { docStatusColors, payStatusColors, currencySymbol, paymentTypeLabels } from "@/components/documents/constants";

interface Props {
  supplierId?: string;
  productId?: string;
  orderId?: string;
}

export default function DocumentsSection({ supplierId, productId, orderId }: Props) {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let docQuery = supabase.from("purchase_documents").select("*").order("created_at", { ascending: false }) as any;
    if (supplierId) docQuery = docQuery.eq("supplier_id", supplierId);
    else if (productId) docQuery = docQuery.eq("product_id", productId);
    else if (orderId) docQuery = docQuery.eq("order_id", orderId);

    const { data: docData } = await docQuery;
    if (docData) setDocs(docData as PurchaseDocument[]);

    // Fetch payments only for supplier context
    if (supplierId) {
      const { data: payData } = await supabase.from("supplier_payments").select("*").eq("supplier_id", supplierId).order("created_at", { ascending: false });
      if (payData) setPayments(payData as Payment[]);
    }

    setLoading(false);
  }, [supplierId, productId, orderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          <Button variant="outline" size="sm" onClick={() => navigate("/documents")}>
            <Plus className="h-3.5 w-3.5 ml-1" />הוסף מסמך
          </Button>
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">אין מסמכים משויכים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
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
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-bold", doc.type === "PI" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent")}>
                        {doc.type}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono" dir="ltr">
                      {doc.total_price ? `${currencySymbol[doc.currency] || ""}${doc.total_price.toLocaleString()}` : "—"}
                    </td>
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{format(new Date(doc.created_at), "dd/MM/yy")}</td>
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
                        <td className="p-3 font-mono" dir="ltr">{currencySymbol[p.currency] || ""}{p.amount.toLocaleString()}</td>
                        <td className="p-3 text-muted-foreground">{paymentTypeLabels[p.payment_type] || p.payment_type}</td>
                        <td className="p-3 text-muted-foreground text-xs">{p.due_date ? format(new Date(p.due_date), "dd/MM/yy") : "—"}</td>
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
