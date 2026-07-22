import { LEGEND_ITEMS } from "./treemapColors";

export default function TreemapLegend() {
  const gradient = LEGEND_ITEMS.map((item, i) => {
    const pct = (i / (LEGEND_ITEMS.length - 1)) * 100;
    return `${item.color} ${pct}%`;
  }).join(", ");

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <span className="text-xs font-semibold text-foreground shrink-0">מצב מלאי:</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-muted-foreground shrink-0">{LEGEND_ITEMS[0].label}</span>
        <div
          className="h-3 rounded-full"
          style={{
            width: 200,
            background: `linear-gradient(to right, ${gradient})`,
            border: "1px solid rgba(0,0,0,0.3)",
          }}
        />
        <span className="text-[9px] text-muted-foreground shrink-0">{LEGEND_ITEMS[LEGEND_ITEMS.length - 1].label}</span>
      </div>
      <div className="flex items-center gap-1 mr-2">
        <div className="h-3 w-5 rounded-full bg-[#374151]" style={{ border: "1px solid rgba(0,0,0,0.3)" }} />
        <span className="text-[9px] text-muted-foreground">אין נתונים</span>
      </div>
    </div>
  );
}
