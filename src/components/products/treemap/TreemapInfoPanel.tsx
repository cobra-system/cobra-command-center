import { useNavigate } from "react-router-dom";
import { ExternalLink, X } from "lucide-react";
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

  return (
    <div
      className="flex items-center gap-4 px-4 py-2.5 bg-card border border-border rounded-lg shadow-lg text-sm"
      dir="rtl"
    >
      <div
        className="h-8 w-8 rounded shrink-0"
        style={{ backgroundColor: health.color, border: "1px solid rgba(0,0,0,0.2)" }}
      />
      <div className="flex-1 flex flex-wrap items-center gap-x-5 gap-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground truncate max-w-[200px]">{item.name}</span>
          <span className="font-mono text-xs text-muted-foreground" dir="ltr">{item.sku}</span>
        </div>
        <Field label="מלאי" value={item.stockQty.toLocaleString()} />
        {item.incomingQty != null && item.incomingQty > 0 && (
          <Field label='עול"ב' value={item.incomingQty.toLocaleString()} />
        )}
        <Field label="צריכה חודשית" value={item.consumption.toLocaleString()} />
        <Field label="חודשי מלאי" value={months} />
        {item.supplier && <Field label="ספק" value={item.supplier} />}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">סטטוס:</span>
          <span className="text-xs font-semibold" style={{ color: health.color }}>{health.label}</span>
        </div>
      </div>
      <button
        onClick={() => navigate(`/products/${item.id}`)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
      >
        <ExternalLink className="h-3 w-3" />
        תיק מוצר
      </button>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-muted transition-colors shrink-0"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
