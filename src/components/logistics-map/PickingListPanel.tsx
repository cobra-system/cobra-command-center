import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, X, MapPin } from "lucide-react";
import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";

import { format } from "date-fns";
interface PickingListPanelProps {
  selectedZones: WarehouseZone[];
  zoneInventoryMap: Map<string, ZoneInventoryData>;
  open: boolean;
  onClose: () => void;
  onDeselectZone: (zoneId: string) => void;
}

export default function PickingListPanel({
  selectedZones,
  zoneInventoryMap,
  open,
  onClose,
  onDeselectZone,
}: PickingListPanelProps) {
  // Sort zones by position: top-to-bottom, right-to-left (RTL reading order)
  const sortedZones = [...selectedZones].sort((a, b) => {
    const [aRow] = a.gridRow.split(" / ").map(Number);
    const [bRow] = b.gridRow.split(" / ").map(Number);
    if (aRow !== bRow) return aRow - bRow;
    // In RTL, lower col number = further right = pick first
    const [aCol] = a.gridColumn.split(" / ").map(Number);
    const [bCol] = b.gridColumn.split(" / ").map(Number);
    return aCol - bCol;
  });

  const totalItems = sortedZones.reduce((sum, zone) => {
    const inv = zoneInventoryMap.get(zone.id);
    return sum + (inv?.products.length ?? 0);
  }, 0);

  const handlePrint = () => {
    const content = sortedZones
      .map((zone, i) => {
        const inv = zoneInventoryMap.get(zone.id);
        const products = inv?.products ?? [];
        const lines = [
          `${i + 1}. ${zone.name.replace(/\n/g, " ")} [${zone.gridRow} | ${zone.gridColumn}]`,
          ...products.map((p) => `   • ${p.name} (${p.sku}) — מלאי: ${p.quantity}`),
          products.length === 0 ? "   (ריק)" : "",
        ];
        return lines.filter(Boolean).join("\n");
      })
      .join("\n\n");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl">
        <head>
          <title>רשימת ליקוט — קוברה</title>
          <style>
            body { font-family: sans-serif; padding: 24px; direction: rtl; }
            h1 { font-size: 18px; margin-bottom: 16px; }
            pre { font-size: 13px; line-height: 1.8; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>רשימת ליקוט — ${format(new Date(), "dd/MM/yyyy")}</h1>
          <pre>${content}</pre>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[75vh] flex flex-col overflow-hidden">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-primary" />
            <SheetTitle>רשימת ליקוט</SheetTitle>
            <Badge variant="secondary" className="mr-auto">
              {selectedZones.length} אזורים · {totalItems} פריטים
            </Badge>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 ml-1" />
              הדפס
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            סדר הליקוט לפי מיקום פיזי (שורה → עמודה)
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-3 -mx-6 px-6 space-y-3">
          {sortedZones.map((zone, i) => {
            const inv = zoneInventoryMap.get(zone.id);
            const products = inv?.products ?? [];
            return (
              <div key={zone.id} className="border rounded-lg p-3 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: zone.color }}
                  />
                  <span className="font-medium text-sm flex-1">
                    {zone.name.replace(/\n/g, " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    שורה {zone.gridRow.split(" / ")[0]}
                  </span>
                  <button
                    onClick={() => onDeselectZone(zone.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground pr-7">אין מוצרים מוגדרים</p>
                ) : (
                  <div className="space-y-0.5 pr-7">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="flex-1 truncate">{p.name}</span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono flex-shrink-0"
                        >
                          {p.sku}
                        </Badge>
                        <span
                          className={`font-medium flex-shrink-0 ${
                            p.isLowStock ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {p.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
