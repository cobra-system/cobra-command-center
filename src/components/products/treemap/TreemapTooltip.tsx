import type { TreemapItem } from "./treemapLayout";
import { getHealthLabel } from "./treemapColors";

interface Props {
  item: TreemapItem;
  x: number;
  y: number;
}

export default function TreemapTooltip({ item, x, y }: Props) {
  const months = item.consumption > 0 ? (item.stockQty / item.consumption).toFixed(1) : "—";
  const statusLabel = getHealthLabel(item.stockQty, item.consumption);

  return (
    <div
      className="fixed z-[9999] pointer-events-none bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[220px] text-sm"
      style={{ left: x + 12, top: y + 12 }}
      dir="rtl"
    >
      <div className="font-bold text-foreground mb-1 leading-tight">{item.name}</div>
      <div className="text-xs text-muted-foreground font-mono mb-2" dir="ltr">{item.sku}</div>
      <div className="space-y-1 text-xs">
        <Row label="מלאי" value={item.stockQty.toLocaleString()} />
        {item.incomingQty != null && item.incomingQty > 0 && (
          <Row label='עול"ב' value={item.incomingQty.toLocaleString()} />
        )}
        <Row label="צריכה חודשית" value={item.consumption.toLocaleString()} />
        <Row label="חודשי מלאי" value={months} />
        {item.supplier && <Row label="ספק" value={item.supplier} />}
        <Row label="סטטוס" value={statusLabel} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
