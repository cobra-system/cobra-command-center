/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Recycle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { WasteStatusBadge } from "@/components/waste/WasteStatusBadge";
import type { Product } from "@/contexts/AppContext";
import type { WasteItem } from "@/contexts/types";
import { format } from "date-fns";

interface Props {
  product: Product;
}

export function WasteItemsSection({ product }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<WasteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("waste_items")
      .select("*, products(name, sku)")
      .eq("product_id", product.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    setItems(
      (data ?? []).map((row: any) => ({
        ...row,
        product_name: row.products?.name ?? null,
        product_sku: row.products?.sku ?? null,
      })) as WasteItem[],
    );
    setLoading(false);
  }, [product.id]);

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel(`waste-product-${product.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waste_items" }, fetchItems)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchItems, product.id]);

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Recycle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">בלאי</h2>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/waste-management")}>
          <ExternalLink className="h-3.5 w-3.5 ml-1" />
          דף הבלאי
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">טוען...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">אין פריטי בלאי למוצר זה</p>
      ) : (
        <>
          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                  {item.condition_notes && (
                    <p className="text-xs text-muted-foreground truncate">{item.condition_notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{format(new Date(item.created_at), "dd/MM/yyyy")}</p>
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <WasteStatusBadge status={item.status} />
                  <p className="text-xs text-muted-foreground">כמות: {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold text-foreground">כמות</th>
                  <th className="text-right p-3 font-semibold text-foreground">מצב</th>
                  <th className="text-right p-3 font-semibold text-foreground">הערות</th>
                  <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
                  <th className="text-right p-3 font-semibold text-foreground">דווח ע"י</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">{item.quantity}</td>
                    <td className="p-3"><WasteStatusBadge status={item.status} /></td>
                    <td className="p-3 text-muted-foreground max-w-[200px] truncate">{item.condition_notes || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{format(new Date(item.created_at), "dd/MM/yyyy")}</td>
                    <td className="p-3 text-muted-foreground">{item.created_by_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
