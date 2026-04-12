import { AlertTriangle, Plus } from "lucide-react";
import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";

interface ZoneBlockProps {
  zone: WarehouseZone;
  inventoryData?: ZoneInventoryData;
  isHighlighted: boolean;
  isDimmed: boolean;
  onClick: (zone: WarehouseZone) => void;
}

export default function ZoneBlock({
  zone,
  inventoryData,
  isHighlighted,
  isDimmed,
  onClick,
}: ZoneBlockProps) {
  const productCount = inventoryData?.products.length ?? 0;
  const hasLowStock = inventoryData?.hasLowStock ?? false;
  const totalQty = inventoryData?.totalQuantity ?? 0;

  return (
    <button
      onClick={() => onClick(zone)}
      className={`
        relative flex flex-col items-center justify-center
        rounded-md border border-black/10 p-1
        transition-all duration-200 ease-out cursor-pointer select-none
        text-center overflow-hidden
        hover:scale-[1.03] hover:shadow-lg hover:z-10
        active:scale-[0.98]
        ${isHighlighted ? "ring-3 ring-primary shadow-xl z-20 brightness-110" : ""}
        ${isDimmed ? "opacity-30 pointer-events-auto" : ""}
      `}
      style={{
        gridRow: zone.gridRow,
        gridColumn: zone.gridColumn,
        backgroundColor: zone.color,
        color: zone.textColor,
      }}
      title={zone.name.replace(/\n/g, " ")}
    >
      {/* Zone name */}
      <span className="text-[10px] sm:text-xs font-bold leading-tight whitespace-pre-line">
        {zone.name}
      </span>

      {/* Product count & quantity */}
      {!zone.isNonProduct && productCount > 0 && (
        <span className="text-[9px] sm:text-[10px] mt-0.5 opacity-80 font-medium">
          {productCount} מוצרים · {totalQty}
        </span>
      )}

      {/* Empty zone hint */}
      {!zone.isNonProduct && productCount === 0 && (
        <Plus className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 opacity-40" />
      )}

      {/* Low stock warning */}
      {hasLowStock && (
        <div className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1">
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 drop-shadow" />
        </div>
      )}
    </button>
  );
}
