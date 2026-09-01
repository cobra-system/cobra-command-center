import { AlertTriangle, Plus } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";

// ── Heatmap ───────────────────────────────────────────────────────────────────

export type ZoneHealth = "critical" | "warning" | "ok" | "empty" | "nonProduct";

export function computeZoneHealth(
  zone: WarehouseZone,
  data?: ZoneInventoryData,
): ZoneHealth {
  if (zone.isNonProduct) return "nonProduct";
  const products = data?.products ?? [];
  if (products.length === 0) return "empty";
  if (data?.hasLowStock) return "critical";
  if (products.some((p) => p.quantity === 0)) return "warning";
  return "ok";
}

const HEATMAP_COLORS: Record<ZoneHealth, { bg: string; text: string }> = {
  critical:   { bg: "#ef4444", text: "#ffffff" },
  warning:    { bg: "#f97316", text: "#ffffff" },
  ok:         { bg: "#22c55e", text: "#ffffff" },
  empty:      { bg: "#e5e7eb", text: "#9ca3af" },
  nonProduct: { bg: "", text: "" }, // keep original
};

// ── Dynamic Lucide icon ───────────────────────────────────────────────────────

function ZoneIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as Record<string, unknown>)[name] as
    | React.ComponentType<{ className?: string }>
    | undefined;
  if (!Icon) return null;
  return <Icon className={className} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ZoneBlockProps {
  zone: WarehouseZone;
  inventoryData?: ZoneInventoryData;
  isHighlighted: boolean;
  isDimmed: boolean;
  heatmapMode: boolean;
  onClick: (zone: WarehouseZone) => void;
  // drag-and-drop (edit mode)
  editMode?: boolean;
  onDragStart?: (zone: WarehouseZone, e: React.PointerEvent) => void;
  onResizeStart?: (zone: WarehouseZone, handle: ResizeHandle, e: React.PointerEvent) => void;
}

export type ResizeHandle = "se" | "sw" | "ne" | "nw" | "n" | "s" | "e" | "w";

export default function ZoneBlock({
  zone,
  inventoryData,
  isHighlighted,
  isDimmed,
  heatmapMode,
  onClick,
  editMode = false,
  onDragStart,
  onResizeStart,
}: ZoneBlockProps) {
  const productCount = inventoryData?.products.length ?? 0;
  const hasLowStock = inventoryData?.hasLowStock ?? false;
  const totalQty = inventoryData?.totalQuantity ?? 0;

  const health = computeZoneHealth(zone, inventoryData);
  const heatColor = heatmapMode && health !== "nonProduct"
    ? HEATMAP_COLORS[health]
    : null;

  const bgColor = heatColor?.bg || zone.color;
  const textColor = heatColor?.text || zone.textColor;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editMode && onDragStart) {
      e.preventDefault();
      e.stopPropagation();
      onDragStart(zone, e);
    }
  };

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center
        rounded-md border border-black/10 p-1
        transition-colors duration-200 overflow-hidden
        text-center select-none
        ${editMode
          ? "cursor-grab active:cursor-grabbing ring-2 ring-primary/50 hover:ring-primary"
          : "cursor-pointer hover:scale-[1.03] hover:shadow-lg hover:z-10 active:scale-[0.98]"
        }
        ${isHighlighted && !heatmapMode ? "ring-3 ring-primary shadow-xl z-20 brightness-110" : ""}
        ${isDimmed ? "opacity-30" : ""}
      `}
      style={{
        gridRow: zone.gridRow,
        gridColumn: zone.gridColumn,
        backgroundColor: bgColor,
        color: textColor,
        transition: heatmapMode ? "background-color 0.4s ease, color 0.4s ease" : undefined,
      }}
      title={zone.name.replace(/\n/g, " ")}
      onPointerDown={handlePointerDown}
      onClick={editMode ? undefined : () => onClick(zone)}
    >
      {/* Lucide icon (utility/entrance zones) */}
      {zone.icon && (
        <ZoneIcon
          name={zone.icon}
          className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 opacity-80"
        />
      )}

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

      {/* Utilization bar (when capacity is set) */}
      {!zone.isNonProduct && zone.capacity && zone.capacity > 0 && (
        <UtilizationBar current={totalQty} capacity={zone.capacity} />
      )}

      {/* Empty zone hint */}
      {!zone.isNonProduct && productCount === 0 && !editMode && (
        <Plus className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 opacity-40" />
      )}

      {/* Low stock warning */}
      {hasLowStock && !heatmapMode && (
        <div className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1">
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 drop-shadow" />
        </div>
      )}

      {/* Heatmap badge */}
      {heatmapMode && health === "critical" && (
        <div className="absolute top-0.5 right-0.5">
          <AlertTriangle className="w-3 h-3 opacity-90" />
        </div>
      )}

      {/* Resize handles (edit mode) */}
      {editMode && onResizeStart && (
        <ResizeHandles zone={zone} onResizeStart={onResizeStart} />
      )}
    </div>
  );
}

// ── Utilization bar ───────────────────────────────────────────────────────────

function UtilizationBar({ current, capacity }: { current: number; capacity: number }) {
  const pct = Math.min(100, Math.round((current / capacity) * 100));
  const color =
    pct >= 90 ? "#ef4444" :
    pct >= 70 ? "#f97316" :
    "#22c55e";

  return (
    <div className="w-full mt-1 px-1">
      <div className="h-1 rounded-full bg-black/20 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[8px] opacity-70">{pct}%</span>
    </div>
  );
}

// ── Resize handles ────────────────────────────────────────────────────────────

/** Only the corners get a visible grab handle; WarehouseMap derives the edge
 *  axes from the handle name, so `n`/`s`/`e`/`w` need no position of their own. */
type CornerHandle = Extract<ResizeHandle, "nw" | "ne" | "sw" | "se">;

const HANDLE_POSITIONS: Record<CornerHandle, string> = {
  nw: "top-0 right-0 cursor-nw-resize",
  ne: "top-0 left-0 cursor-ne-resize",
  sw: "bottom-0 right-0 cursor-sw-resize",
  se: "bottom-0 left-0 cursor-se-resize",
};

function ResizeHandles({
  zone,
  onResizeStart,
}: {
  zone: WarehouseZone;
  onResizeStart: (zone: WarehouseZone, handle: ResizeHandle, e: React.PointerEvent) => void;
}) {
  return (
    <>
      {(Object.keys(HANDLE_POSITIONS) as CornerHandle[]).map((handle) => (
        <div
          key={handle}
          className={`absolute w-3 h-3 bg-white border-2 border-primary rounded-sm z-30 ${HANDLE_POSITIONS[handle]}`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart(zone, handle, e);
          }}
        />
      ))}
    </>
  );
}
