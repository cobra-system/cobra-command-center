import { LEGEND_ITEMS } from "./treemapColors";

export default function TreemapLegend() {
  return (
    <div className="flex items-center gap-1 justify-center py-2">
      {LEGEND_ITEMS.map(item => (
        <div key={item.label} className="flex items-center gap-1">
          <div
            className="h-4 w-8 rounded-sm border border-white/20"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-[10px] text-muted-foreground ml-1">{item.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1 mr-2">
        <div className="h-4 w-8 rounded-sm border border-border bg-[#6b7280]" />
        <span className="text-[10px] text-muted-foreground ml-1">אין נתונים</span>
      </div>
    </div>
  );
}
