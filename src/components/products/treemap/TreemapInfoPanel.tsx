import { useNavigate } from "react-router-dom";
import { ExternalLink, X, ShoppingCart, Truck, Clock, AlertTriangle, Calendar } from "lucide-react";
import type { TreemapItem } from "./treemapLayout";
import { getHealthInfo } from "./treemapColors";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  item: TreemapItem;
  onClose: () => void;
}

export default function TreemapInfoPanel({ item, onClose }: Props) {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const health = getHealthInfo(item.stockQty, item.consumption);
  const months = item.consumption > 0 ? (item.stockQty / item.consumption).toFixed(1) : "—";
  const stockValue = item.purchasePrice
    ? formatPrice(item.stockQty * item.purchasePrice)
    : null;

  return (
    <div
      className="px-3 py-2 sm:px-4 bg-card border border-border rounded-lg shadow-lg text-sm animate-in slide-in-from-bottom-2 duration-200"
      dir="rtl"
    >
      {/* ── Mobile: stacked. Desktop: single row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">

        {/* Health square + name + close (mobile row) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="h-9 w-9 sm:h-10 sm:w-10 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: health.color, border: "1px solid rgba(0,0,0,0.2)" }}
          >
            <span className="text-white text-[9px] sm:text-[10px] font-bold">{months === "—" ? "—" : `${months}m`}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-foreground truncate max-w-[140px] sm:max-w-[180px]">{item.name}</span>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0" dir="ltr">{item.sku}</span>
              {item.productType && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium shrink-0">{item.productType}</span>
              )}
              <span className="font-semibold text-xs shrink-0" style={{ color: health.color }}>{health.label}</span>
            </div>
          </div>

          {/* Close on mobile: top-right of the name row */}
          <button
            onClick={onClose}
            className="sm:hidden p-1 rounded hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
          <Field label="מלאי" value={item.stockQty.toLocaleString()} />
          {(item.incomingQty ?? 0) > 0 && (
            <Field label='עול"ב' value={`+${item.incomingQty!.toLocaleString()}`} className="text-blue-600 dark:text-blue-400" />
          )}
          <Field label="צריכה/חודש" value={item.consumption.toLocaleString()} />
          <Field label="חודשי מלאי" value={months} />
          {stockValue && <Field label="שווי" value={stockValue} />}
          {item.purchasePrice != null && <Field label="מחיר" value={formatPrice(item.purchasePrice)} />}
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
              <span className="truncate max-w-[80px] sm:max-w-none">{item.supplier}</span>
            </button>
          )}
          {item.reorderPoint != null && item.reorderPoint > 0 && item.stockQty <= item.reorderPoint && (
            <span className="flex items-center gap-0.5 text-red-500 font-medium">
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">מתחת לנקודת הזמנה ({item.reorderPoint})</span>
              <span className="sm:hidden">נק' הזמנה</span>
            </span>
          )}
          {(item.openIssues ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-amber-500 font-medium">
              <AlertTriangle className="h-3 w-3" />
              {item.openIssues} תקלות
            </span>
          )}
          {item.lastOrderDate && (
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="hidden sm:inline">{item.lastOrderDate}</span>
              <span className="sm:hidden">{item.lastOrderDate.slice(0, 7)}</span>
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 sm:shrink-0">
          <button
            onClick={() => navigate(`/orders?newOrder=true&productId=${item.id}`)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            title="צור הזמנה"
          >
            <ShoppingCart className="h-3 w-3" />
            הזמנה
          </button>
          <button
            onClick={() => navigate(`/products/${item.id}`)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            תיק מוצר
          </button>
          <button
            onClick={onClose}
            className="hidden sm:block p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
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
