import { useRef, useLayoutEffect, useState } from "react";
import type { TreemapItem } from "./treemapLayout";
import { getHealthInfo } from "./treemapColors";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  item: TreemapItem;
  x: number;
  y: number;
}

export default function TreemapTooltip({ item, x, y }: Props) {
  const { formatPrice } = useCurrency();
  const health = getHealthInfo(item.stockQty, item.consumption);
  const months = item.consumption > 0 ? (item.stockQty / item.consumption).toFixed(1) : "—";
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ dx: 12, dy: 12 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let dx = 12, dy = 12;
    if (x + 12 + rect.width > window.innerWidth - 8) dx = -rect.width - 12;
    if (y + 12 + rect.height > window.innerHeight - 8) dy = -rect.height - 12;
    setOffset({ dx, dy });
  }, [x, y]);

  const stockValue = item.purchasePrice ? item.stockQty * item.purchasePrice : null;

  return (
    <div
      ref={ref}
      className="fixed z-[9999] pointer-events-none bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[220px] text-sm"
      style={{ left: x + offset.dx, top: y + offset.dy }}
      dir="rtl"
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="h-3 w-3 rounded-sm shrink-0"
          style={{ backgroundColor: health.color }}
        />
        <span className="font-bold text-foreground leading-tight truncate">{item.name}</span>
      </div>
      <div className="text-xs text-muted-foreground font-mono mb-2" dir="ltr">{item.sku}</div>
      <div className="space-y-1 text-xs">
        <Row label="מלאי" value={item.stockQty.toLocaleString()} />
        {(item.incomingQty ?? 0) > 0 && (
          <Row label='עול"ב' value={`+${item.incomingQty!.toLocaleString()}`} className="text-blue-600 dark:text-blue-400" />
        )}
        <Row label="צריכה חודשית" value={item.consumption.toLocaleString()} />
        {item.reorderPoint != null && item.reorderPoint > 0 && (
          <Row
            label="נקודת הזמנה"
            value={item.reorderPoint.toLocaleString()}
            className={item.stockQty <= item.reorderPoint ? "text-red-500" : undefined}
          />
        )}
        <Row label="חודשי מלאי" value={months} />
        {item.purchasePrice != null && (
          <Row label="מחיר" value={formatPrice(item.purchasePrice)} />
        )}
        {stockValue != null && stockValue > 0 && (
          <Row label="שווי מלאי" value={formatPrice(stockValue)} />
        )}
        {item.supplier && <Row label="ספק" value={item.supplier} />}
        {(item.openIssues ?? 0) > 0 && (
          <Row label="תקלות פתוחות" value={String(item.openIssues)} className="text-amber-500" />
        )}
        {item.lastOrderDate && (
          <Row label="הזמנה אחרונה" value={item.lastOrderDate} />
        )}
        <Row label="סטטוס" value={health.label} style={{ color: health.color }} />
      </div>
      <div className="mt-2 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground text-center">
        לחץ לפרטים נוספים
      </div>
    </div>
  );
}

function Row({ label, value, className, style }: { label: string; value: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium text-foreground ${className ?? ""}`} style={style}>{value}</span>
    </div>
  );
}
