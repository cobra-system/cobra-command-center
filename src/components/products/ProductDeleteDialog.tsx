import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ProductImpact {
  orderItems: number;
  components: number;
  centerInventory: number;
  complianceLinks: number;
  issues: number;
  purchaseDocuments: number;
  priceQuotes: number;
  equipmentPickupItems: number;
  equipmentReturnItems: number;
  warehouseZoneProducts: number;
}

interface Props {
  open: boolean;
  productId: string;
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProductDeleteDialog({ open, productId, productName, onConfirm, onCancel }: Props) {
  const [impact, setImpact] = useState<ProductImpact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !productId) return;
    setImpact(null);
    setLoading(true);

    Promise.all([
      supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("product_components").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("center_inventory").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("compliance_product_links").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("product_issues").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("purchase_documents").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("supplier_price_quotes").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("equipment_pickup_items").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("equipment_return_items").select("id", { count: "exact", head: true }).eq("product_id", productId),
      supabase.from("warehouse_zone_products").select("id", { count: "exact", head: true }).eq("product_id", productId),
    ]).then(results => {
      setImpact({
        orderItems: results[0].count ?? 0,
        components: results[1].count ?? 0,
        centerInventory: results[2].count ?? 0,
        complianceLinks: results[3].count ?? 0,
        issues: results[4].count ?? 0,
        purchaseDocuments: results[5].count ?? 0,
        priceQuotes: results[6].count ?? 0,
        equipmentPickupItems: results[7].count ?? 0,
        equipmentReturnItems: results[8].count ?? 0,
        warehouseZoneProducts: results[9].count ?? 0,
      });
    }).finally(() => setLoading(false));
  }, [open, productId]);

  const rows: { label: string; count: number; action: "ימחק" | "יינותק" }[] = impact ? [
    { label: "רכיבי מוצר", count: impact.components, action: "ימחק" },
    { label: "פריטי הזמנה", count: impact.orderItems, action: "יינותק" },
    { label: "רשומות מלאי", count: impact.centerInventory, action: "ימחק" },
    { label: "קישורי ציות", count: impact.complianceLinks, action: "ימחק" },
    { label: "בעיות מוצר", count: impact.issues, action: "ימחק" },
    { label: "מסמכי רכש", count: impact.purchaseDocuments, action: "יינותק" },
    { label: "ציטוטי מחיר", count: impact.priceQuotes, action: "יינותק" },
    { label: "פריטי איסוף ציוד", count: impact.equipmentPickupItems, action: "ימחק" },
    { label: "פריטי החזרת ציוד", count: impact.equipmentReturnItems, action: "ימחק" },
    { label: "הקצאות מחסן", count: impact.warehouseZoneProducts, action: "ימחק" },
  ].filter(r => r.count > 0) : [];

  return (
    <Dialog open={open} onOpenChange={open ? onCancel : undefined}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            מחיקת מוצר
          </DialogTitle>
          <DialogDescription>
            האם למחוק את <span className="font-semibold text-foreground">"{productName}"</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">בודק השפעות...</span>
            </div>
          ) : rows.length > 0 ? (
            <div className="rounded-md border bg-destructive/5 p-3 space-y-1">
              <p className="text-sm font-medium text-destructive mb-2">הפעולות הבאות יתבצעו:</p>
              {rows.map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={`font-medium ${row.action === "ימחק" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                    {row.count} {row.action}
                  </span>
                </div>
              ))}
            </div>
          ) : !loading ? (
            <p className="text-sm text-muted-foreground">לא נמצאו רשומות קשורות.</p>
          ) : null}

          <p className="text-xs text-muted-foreground">פעולה זו אינה ניתנת לביטול.</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>ביטול</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            מחק
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
