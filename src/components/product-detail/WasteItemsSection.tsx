import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Recycle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/contexts/AppContext";

interface WasteItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  in_use: boolean;
  recommendations: string;
  created_by_name: string | null;
  created_at: string;
}

interface WasteItemsSectionProps {
  product: Product;
}

const statusCls = (inUse: boolean) =>
  inUse
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";

export function WasteItemsSection({ product }: WasteItemsSectionProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<WasteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Match product itself + all its components by name
  const matchingNames = useMemo(
    () => [product.name, ...(product.components || []).map((c) => c.name)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.id, product.name, (product.components || []).map((c) => c.name).join("|")]
  );

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("waste_items")
      .select("id, product_name, sku, quantity, in_use, recommendations, created_by_name, created_at")
      .in("product_name", matchingNames)
      .order("created_at", { ascending: false });
    setItems((data as WasteItem[]) || []);
    setLoading(false);
  }, [matchingNames]);

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/waste-management")}
          data-navigate-to="/waste-management"
        >
          <ExternalLink className="h-3.5 w-3.5 ml-1" />
          דף הבלאי
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">טוען...</p>
      ) : items.length > 0 ? (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
                  {item.recommendations && (
                    <p className="text-xs text-muted-foreground truncate">{item.recommendations}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCls(item.in_use)}`}>
                    {item.in_use ? "בשימוש" : "לא בשימוש"}
                  </span>
                  <p className="text-xs text-muted-foreground">כמות: {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold text-foreground">פריט</th>
                  <th className="text-right p-3 font-semibold text-foreground">כמות</th>
                  <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                  <th className="text-right p-3 font-semibold text-foreground">המלצות</th>
                  <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
                  <th className="text-right p-3 font-semibold text-foreground">דווח ע"י</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{item.product_name}</td>
                    <td className="p-3 text-muted-foreground">{item.quantity}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCls(item.in_use)}`}>
                        {item.in_use ? "בשימוש" : "לא בשימוש"}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                      {item.recommendations || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(item.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="p-3 text-muted-foreground">{item.created_by_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">אין פריטי בלאי למוצר זה</p>
      )}
    </div>
  );
}
