import { Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import type { TreemapItem } from "./treemapLayout";

interface Props {
  items: TreemapItem[];
}

export default function TreemapStatsBar({ items }: Props) {
  const total = items.length;
  const critical = items.filter(i => i.consumption > 0 && i.stockQty / i.consumption < 1).length;
  const outOfStock = items.filter(i => i.stockQty <= 0 && i.consumption > 0).length;
  const healthy = items.filter(i => i.consumption > 0 && i.stockQty / i.consumption >= 3).length;

  const totalStockValue = items.reduce((s, i) => {
    if (i.purchasePrice && i.purchasePrice > 0) return s + i.stockQty * i.purchasePrice;
    return s;
  }, 0);

  const avgMonths = (() => {
    const withConsumption = items.filter(i => i.consumption > 0);
    if (withConsumption.length === 0) return 0;
    const sum = withConsumption.reduce((s, i) => s + i.stockQty / i.consumption, 0);
    return sum / withConsumption.length;
  })();

  return (
    <div className="flex flex-wrap gap-3 items-center text-xs" dir="rtl">
      <Stat icon={<Package className="h-3.5 w-3.5" />} label="מוצרים" value={total.toString()} />
      {outOfStock > 0 && (
        <Stat
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="אזל"
          value={outOfStock.toString()}
          className="text-red-600 dark:text-red-400"
        />
      )}
      {critical > 0 && (
        <Stat
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="קריטי"
          value={critical.toString()}
          className="text-orange-600 dark:text-orange-400"
        />
      )}
      <Stat
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="תקין"
        value={healthy.toString()}
        className="text-green-600 dark:text-green-400"
      />
      <Stat
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="ממוצע חודשי מלאי"
        value={avgMonths.toFixed(1)}
      />
      {totalStockValue > 0 && (
        <Stat
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="שווי מלאי"
          value={`$${totalStockValue.toLocaleString()}`}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-md ${className ?? ""}`}>
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
