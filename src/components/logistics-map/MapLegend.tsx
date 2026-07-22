import { ZONE_TYPE_LABELS, ZONE_TYPE_COLORS, type ZoneType } from "@/data/warehouseZones";

const LEGEND_ITEMS: ZoneType[] = ["shelving", "storage", "product", "utility", "entrance"];

const HEATMAP_ITEMS = [
  { label: "מלאי תקין",      color: "#22c55e" },
  { label: "מלאי נמוך",      color: "#f97316" },
  { label: "מלאי קריטי",     color: "#ef4444" },
  { label: "ריק (לא הוגדר)", color: "#e5e7eb" },
];

interface MapLegendProps {
  heatmapMode: boolean;
}

export default function MapLegend({ heatmapMode }: MapLegendProps) {
  const items = heatmapMode
    ? HEATMAP_ITEMS
    : LEGEND_ITEMS.map((type) => ({ label: ZONE_TYPE_LABELS[type], color: ZONE_TYPE_COLORS[type] }));

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">מקרא:</span>
      {items.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm border border-black/10"
            style={{ backgroundColor: color }}
          />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
