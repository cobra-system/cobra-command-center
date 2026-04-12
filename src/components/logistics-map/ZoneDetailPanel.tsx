import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, Pencil, ExternalLink, ArrowDown, Settings } from "lucide-react";
import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";

interface ZoneDetailPanelProps {
  zone: WarehouseZone | null;
  inventoryData?: ZoneInventoryData;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onZoneConfig: () => void;
  canEdit: boolean;
}

export default function ZoneDetailPanel({
  zone,
  inventoryData,
  open,
  onClose,
  onEdit,
  onZoneConfig,
  canEdit,
}: ZoneDetailPanelProps) {
  if (!zone) return null;

  const products = inventoryData?.products ?? [];
  const totalQty = inventoryData?.totalQuantity ?? 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded border border-black/10 flex-shrink-0"
              style={{ backgroundColor: zone.color }}
            />
            <SheetTitle className="text-lg">{zone.name.replace(/\n/g, " ")}</SheetTitle>
            <div className="mr-auto flex gap-1">
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={onZoneConfig}>
                  <Settings className="w-4 h-4 ml-1" />
                  ערוך אזור
                </Button>
              )}
              {canEdit && !zone.isNonProduct && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Pencil className="w-4 h-4 ml-1" />
                  עריכת מוצרים
                </Button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="flex gap-3 text-sm text-muted-foreground pt-1">
            <span>{products.length} מוצרים</span>
            <span>·</span>
            <span>סה״כ {totalQty} יחידות</span>
            {inventoryData?.hasLowStock && (
              <>
                <span>·</span>
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  מלאי נמוך
                </span>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto mt-3 -mx-6 px-6">
          {zone.isNonProduct ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              אזור זה אינו מכיל מוצרים
            </div>
          ) : products.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              לא הוגדרו מוצרים לאזור זה
              {canEdit && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Pencil className="w-3 h-3 ml-1" />
                    הוסף מוצרים
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {products.map((product) => (
                <div
                  key={product.id}
                  className={`
                    flex items-center gap-3 p-2.5 rounded-lg border transition-colors
                    ${product.isLowStock ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{product.name}</span>
                      <Badge variant="secondary" className="text-[10px] font-mono flex-shrink-0">
                        {product.sku}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>מלאי מקומי: <strong className="text-foreground">{product.quantity}</strong></span>
                      {product.minStock > 0 && (
                        <span>מינימום: {product.minStock}</span>
                      )}
                      {product.incomingQty > 0 && (
                        <span className="flex items-center gap-0.5 text-primary">
                          <ArrowDown className="w-3 h-3" />
                          בדרך: {product.incomingQty}
                        </span>
                      )}
                    </div>
                  </div>

                  {product.isLowStock && (
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                  )}

                  <Link
                    to={`/products/${product.id}`}
                    className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                    title="צפה במוצר"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
