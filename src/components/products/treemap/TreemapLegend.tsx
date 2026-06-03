import { LEGEND_ITEMS } from "./treemapColors";

export default function TreemapLegend() {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <span className="text-xs font-semibold text-foreground">מצב מלאי:</span>
      <div className="flex items-center gap-1">
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} className="flex items-center gap-0.5">
            <div
              className="h-4 w-6 rounded-sm"
              style={{ backgroundColor: item.color, border: "1px solid rgba(0,0,0,0.3)" }}
            />
            <span className="text-[9px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-0.5 mr-2">
          <div className="h-4 w-6 rounded-sm bg-[#374151]" style={{ border: "1px solid rgba(0,0,0,0.3)" }} />
          <span className="text-[9px] text-muted-foreground">אין נתונים</span>
        </div>
      </div>
    </div>
  );
}
