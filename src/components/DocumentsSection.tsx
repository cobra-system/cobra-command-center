import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface PurchaseDocument {
  id: string;
  type: string;
  supplier_id: string | null;
  product_id: string | null;
  status: string;
  total_price: number | null;
  currency: string;
  file_url: string | null;
  notes: string | null;
  created_at: string;
}

const docStatusColors: Record<string, string> = {
  "ממתין לאישור": "bg-warning/15 text-warning",
  "אושר": "bg-primary/15 text-primary",
  "נשלח לספק": "bg-accent/15 text-accent",
  "בוצע": "bg-success/15 text-success",
};
const currencySymbol: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪" };

interface Props {
  supplierId?: string;
  productId?: string;
}

export default function DocumentsSection({ supplierId, productId }: Props) {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("purchase_documents").select("*").order("created_at", { ascending: false });
    if (supplierId) query = query.eq("supplier_id", supplierId);
    else if (productId) query = query.eq("product_id", productId);
    const { data } = await query;
    if (data) setDocs(data as PurchaseDocument[]);
    setLoading(false);
  }, [supplierId, productId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  if (loading) return null;

  return (
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
        <div className="space-y-2">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${doc.type === "PI" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                {doc.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.notes || `${doc.type} מ-${format(new Date(doc.created_at), "dd/MM/yy")}`}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), "dd/MM/yyyy")}</p>
              </div>
              {doc.total_price && (
                <span className="text-sm font-medium text-foreground shrink-0">
                  {currencySymbol[doc.currency] || ""}{doc.total_price.toLocaleString()}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${docStatusColors[doc.status] || "bg-muted text-muted-foreground"}`}>
                {doc.status}
              </span>
              {doc.file_url && (
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
