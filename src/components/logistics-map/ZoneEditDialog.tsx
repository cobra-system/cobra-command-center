import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { X, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";
import type { Product } from "@/contexts/types";

interface ZoneEditDialogProps {
  zone: WarehouseZone | null;
  inventoryData?: ZoneInventoryData;
  allProducts: Product[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ZoneEditDialog({
  zone,
  inventoryData,
  allProducts,
  open,
  onClose,
  onSaved,
}: ZoneEditDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!zone) return null;

  const currentProducts = inventoryData?.products ?? [];
  const currentProductIds = new Set(currentProducts.map((p) => p.id));

  // Products available to add (not already in this zone)
  const availableOptions: ComboboxOption[] = allProducts
    .filter((p) => !currentProductIds.has(p.id))
    .map((p) => ({
      value: p.id,
      label: `${p.name} (${p.sku})`,
    }));

  const handleAdd = async () => {
    if (!selectedProductId || !zone) return;
    setSaving(true);
    const { error } = await supabase
      .from("warehouse_zone_products")
      .insert({ zone_id: zone.id, product_id: selectedProductId });

    if (error) {
      console.error("[ZoneEditDialog] insert error:", error);
      toast.error(`שגיאה בהוספת מוצר לאזור: ${error.message}`);
    } else {
      toast.success("מוצר הוסף לאזור");
      setSelectedProductId("");
      onSaved();
    }
    setSaving(false);
  };

  const handleRemove = async (productId: string) => {
    if (!zone) return;
    setRemovingId(productId);
    const { error } = await supabase
      .from("warehouse_zone_products")
      .delete()
      .eq("zone_id", zone.id)
      .eq("product_id", productId);

    if (error) {
      console.error("[ZoneEditDialog] delete error:", error);
      toast.error(`שגיאה בהסרת מוצר מהאזור: ${error.message}`);
    } else {
      toast.success("מוצר הוסר מהאזור");
      onSaved();
    }
    setRemovingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded border border-black/10 flex-shrink-0"
              style={{ backgroundColor: zone.color }}
            />
            <DialogTitle>עריכת מוצרים — {zone.name.replace(/\n/g, " ")}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Add product */}
        <div className="space-y-2">
          <label className="text-sm font-medium">הוסף מוצר לאזור</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Combobox
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                options={availableOptions}
                placeholder="בחר מוצר..."
                searchPlaceholder="חפש לפי שם או SKU..."
                emptyText="לא נמצאו מוצרים"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!selectedProductId || saving}
              size="default"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 ml-1" />
              )}
              הוסף
            </Button>
          </div>
        </div>

        {/* Current products */}
        <div className="space-y-2 mt-2">
          <label className="text-sm font-medium">
            מוצרים באזור ({currentProducts.length})
          </label>
          {currentProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
              אין מוצרים מוגדרים לאזור זה
            </div>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {currentProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm truncate">{product.name}</span>
                    <Badge variant="secondary" className="text-[10px] font-mono flex-shrink-0">
                      {product.sku}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(product.id)}
                    disabled={removingId === product.id}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0 h-7 w-7 p-0"
                  >
                    {removingId === product.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
