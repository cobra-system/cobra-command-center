import { useState, useRef, useCallback } from "react";
import { WAREHOUSE_ZONES, type WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";
import ZoneBlock from "./ZoneBlock";

interface WarehouseMapProps {
  zoneInventoryMap: Map<string, ZoneInventoryData>;
  highlightedZoneIds: Set<string>;
  searchActive: boolean;
  onZoneClick: (zone: WarehouseZone) => void;
}

export default function WarehouseMap({
  zoneInventoryMap,
  highlightedZoneIds,
  searchActive,
  onZoneClick,
}: WarehouseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const lastDistance = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDistance.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      const delta = distance / lastDistance.current;
      setScale((prev) => Math.min(3, Math.max(0.5, prev * delta)));
      lastDistance.current = distance;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastDistance.current = null;
  }, []);

  return (
    <div
      className="relative overflow-auto rounded-xl border border-border bg-white shadow-sm"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div
        ref={containerRef}
        className="min-w-[800px] p-3 sm:p-4 origin-top-right"
        style={{ transform: `scale(${scale})`, transformOrigin: "top right" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Floor label */}
        <div className="text-center text-xs text-muted-foreground mb-2 font-medium">
          מחסן לוגיסטר קוברה — תל אביב
        </div>

        {/* CSS Grid floor plan */}
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: "repeat(24, 1fr)",
            gridTemplateRows: "repeat(20, minmax(28px, 1fr))",
            direction: "rtl",
            aspectRatio: "24 / 20",
          }}
        >
          {WAREHOUSE_ZONES.map((zone) => (
            <ZoneBlock
              key={zone.id}
              zone={zone}
              inventoryData={zoneInventoryMap.get(zone.id)}
              isHighlighted={searchActive && highlightedZoneIds.has(zone.id)}
              isDimmed={searchActive && !highlightedZoneIds.has(zone.id)}
              onClick={onZoneClick}
            />
          ))}

          {/* Open floor space — light fill */}
          <div
            className="rounded bg-gray-50 border border-dashed border-gray-200"
            style={{ gridRow: "3 / 5", gridColumn: "5 / 12" }}
          />
          <div
            className="rounded bg-gray-50 border border-dashed border-gray-200"
            style={{ gridRow: "11 / 17", gridColumn: "5 / 25" }}
          />
        </div>
      </div>

      {/* Zoom controls (mobile hint) */}
      <div className="absolute bottom-2 left-2 flex gap-1 sm:hidden">
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          className="w-7 h-7 rounded bg-background border text-xs font-bold shadow"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          className="w-7 h-7 rounded bg-background border text-xs font-bold shadow"
        >
          -
        </button>
        {scale !== 1 && (
          <button
            onClick={() => setScale(1)}
            className="h-7 px-2 rounded bg-background border text-[10px] shadow"
          >
            איפוס
          </button>
        )}
      </div>
    </div>
  );
}
