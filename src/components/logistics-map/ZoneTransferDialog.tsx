import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";

interface ZoneTransferDialogProps {
  zone: WarehouseZone | null;
  inventoryData?: ZoneInventoryData;
  allZones: WarehouseZone[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ZoneTransferDialog({
  zone,
  inventoryData,
  allZones,
  open,
  onClose,
  onSaved,
}: ZoneTransferDialogProps) {
  const products = inventoryData?.products ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [destinationId, setDestinationId] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(products.map((p) => p.id)));
    setDestinationId("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!zone) return null;

  const destinationZones = allZones.filter(
    (z) => z.id !== zone.id && !z.isNonProduct,
  );

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id)),
    );
  };

  const handleTransfer = async () => {
    if (selectedIds.size === 0) {
      toast.error("יש לבחור לפחות מוצר אחד");
      return;
    }
    if (!destinationId) {
      toast.error("יש לבחור אזור יעד");
      return;
    }

    setSaving(true);
    const ids = Array.from(selectedIds);

    // Remove from source
    const { error: deleteError } = await supabase
      .from("warehouse_zone_products")
      .delete()
      .eq("zone_id", zone.id)
      .in("product_id", ids);

    if (deleteError) {
      console.error("[ZoneTransferDialog] delete error:", deleteError);
      toast.error(`שגיאה בהסרה מאזור המקור: ${deleteError.message}`);
      setSaving(false);
      return;
    }

    // Insert into destination (upsert to handle existing assignments gracefully)
    const { error: insertError } = await supabase
      .from("warehouse_zone_products")
      .upsert(
        ids.map((product_id) => ({ zone_id: destinationId, product_id })),
        { onConflict: "zone_id,product_id", ignoreDuplicates: true },
      );

    if (insertError) {
      console.error("[ZoneTransferDialog] insert error:", insertError);
      toast.error(`שגיאה בהוספה לאזור היעד: ${insertError.message}`);
      setSaving(false);
      return;
    }

    const destZone = allZones.find((z) => z.id === destinationId);
    toast.success(
      `${ids.length} מוצרים הועברו ל-${destZone?.name.replace(/\n/g, " ") ?? destinationId}`,
    );
    onSaved();
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            העבר מוצרים מ-{zone.name.replace(/\n/g, " ")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Product selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">בחר מוצרים להעברה</label>
              <button
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {selectedIds.size === products.length ? "בטל הכל" : "בחר הכל"}
              </button>
            </div>
            <div className="space-y-1.5 border rounded-lg p-2 max-h-48 overflow-y-auto">
              {products.map((product) => (
                <label
                  key={product.id}
                  className="flex items-center gap-3 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.has(product.id)}
                    onCheckedChange={() => toggleProduct(product.id)}
                  />
                  <span className="flex-1 text-sm truncate">{product.name}</span>
                  <Badge variant="secondary" className="text-[10px] font-mono flex-shrink-0">
                    {product.sku}
                  </Badge>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedIds.size} מתוך {products.length} נבחרו
            </p>
          </div>

          {/* Destination zone */}
          <div className="space-y-1">
            <label className="text-sm font-medium">אזור יעד</label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר אזור יעד..." />
              </SelectTrigger>
              <SelectContent>
                {destinationZones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: z.color }}
                      />
                      {z.name.replace(/\n/g, " ")}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={saving || selectedIds.size === 0 || !destinationId}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
            <ArrowLeftRight className="w-4 h-4 ml-1" />
            העבר {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
