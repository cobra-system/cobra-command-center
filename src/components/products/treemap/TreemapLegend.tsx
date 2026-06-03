import { LEGEND_ITEMS } from "./treemapColors";

export default function TreemapLegend() {
  return (
    <div className="flex items-center gap-1 justify-center py-2">
      {LEGEND_ITEMS.map(item => (
        <div key={item.label} className="flex items-center gap-1">
          <div
            className="h-4 w-8 rounded-sm"
            style={{ backgroundColor: item.color, border: "1px solid rgba(0,0,0,0.3)" }}
          />
          <span className="text-[10px] text-muted-foreground ml-1">{item.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1 mr-2">
        <div className="h-4 w-8 rounded-sm bg-[#374151]" style={{ border: "1px solid rgba(0,0,0,0.3)" }} />
        <span className="text-[10px] text-muted-foreground ml-1">אין נתונים</span>
      </div>
    </div>
  );
}
