import { useNavigate } from "react-router-dom";
import { ExternalLink, X, ShoppingCart, Truck, Clock } from "lucide-react";
import type { TreemapItem } from "./treemapLayout";
import { getHealthInfo } from "./treemapColors";

interface Props {
  item: TreemapItem;
  onClose: () => void;
}

export default function TreemapInfoPanel({ item, onClose }: Props) {
  const navigate = useNavigate();
  const health = getHealthInfo(item.stockQty, item.consumption);
  const months = item.consumption > 0 ? (item.stockQty / item.consumption).toFixed(1) : "—";
  const stockValue = item.purchasePrice
    ? `$${(item.stockQty * item.purchasePrice).toLocaleString()}`
    : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-lg shadow-lg text-sm"
      dir="rtl"
    >
      <div
        className="h-10 w-10 rounded flex items-center justify-center shrink-0"
        style={{ backgroundColor: health.color, border: "1px solid rgba(0,0,0,0.2)" }}
      >
        <span className="text-white text-[10px] font-bold">{months === "—" ? "—" : `${months}m`}</span>
      </div>

      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground truncate max-w-[180px]">{item.name}</span>
          <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded" dir="ltr">{item.sku}</span>
          {item.productType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">{item.productType}</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Field label="מלאי" value={item.stockQty.toLocaleString()} />
          {(item.incomingQty ?? 0) > 0 && (
            <Field label='עול"ב' value={`+${item.incomingQty!.toLocaleString()}`} className="text-blue-600 dark:text-blue-400" />
          )}
          <Field label="צריכה/חודש" value={item.consumption.toLocaleString()} />
          <Field label="חודשי מלאי" value={months} />
          {stockValue && <Field label="שווי מלאי" value={stockValue} />}
          {item.purchasePrice != null && <Field label="מחיר" value={`$${item.purchasePrice.toLocaleString()}`} />}
          {item.leadTimeDays != null && (
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {item.leadTimeDays}d
            </span>
          )}
          {item.supplier && (
            <button
              onClick={() => item.supplierId && navigate(`/suppliers/${item.supplierId}`)}
              className="flex items-center gap-0.5 text-primary hover:underline"
            >
              <Truck className="h-3 w-3" />
              {item.supplier}
            </button>
          )}
          <span className="font-semibold" style={{ color: health.color }}>{health.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => navigate(`/orders?newOrder=true&productId=${item.id}`)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
          title="צור הזמנה"
        >
          <ShoppingCart className="h-3 w-3" />
          הזמנה
        </button>
        <button
          onClick={() => navigate(`/products/${item.id}`)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          תיק מוצר
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-medium text-foreground ${className ?? ""}`}>{value}</span>
    </span>
  );
}
