import { ZONE_TYPE_LABELS, ZONE_TYPE_COLORS, type ZoneType } from "@/data/warehouseZones";

const LEGEND_ITEMS: ZoneType[] = ["shelving", "storage", "product", "utility", "entrance"];

export default function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">מקרא:</span>
      {LEGEND_ITEMS.map((type) => (
        <div key={type} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm border border-black/10"
            style={{ backgroundColor: ZONE_TYPE_COLORS[type] }}
          />
          <span>{ZONE_TYPE_LABELS[type]}</span>
        </div>
      ))}
    </div>
  );
}
