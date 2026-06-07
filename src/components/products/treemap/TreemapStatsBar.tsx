import { Package, AlertTriangle, TrendingUp, DollarSign, Bug, ShoppingCart } from "lucide-react";
import type { TreemapItem } from "./treemapLayout";

interface Props {
  items: TreemapItem[];
}

export default function TreemapStatsBar({ items }: Props) {
  const total = items.length;
  const critical = items.filter(i => i.consumption > 0 && i.stockQty / i.consumption < 1).length;
  const outOfStock = items.filter(i => i.stockQty <= 0 && i.consumption > 0).length;
  const healthy = items.filter(i => i.consumption > 0 && i.stockQty / i.consumption >= 3).length;
  const withIssues = items.filter(i => (i.openIssues ?? 0) > 0).length;
  const needsReorder = items.filter(i => i.reorderPoint != null && i.reorderPoint > 0 && i.stockQty <= i.reorderPoint).length;

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
    <div className="flex flex-wrap gap-1.5 sm:gap-3 items-center text-[11px] sm:text-xs" dir="rtl">
      <Stat icon={<Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />} label="מוצרים" value={total.toString()} />
      {outOfStock > 0 && (
        <Stat
          icon={<AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          label="אזל"
          value={outOfStock.toString()}
          className="text-red-600 dark:text-red-400"
        />
      )}
      {critical > 0 && (
        <Stat
          icon={<AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          label="קריטי"
          value={critical.toString()}
          className="text-orange-600 dark:text-orange-400"
        />
      )}
      <Stat
        icon={<TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
        label="תקין"
        value={healthy.toString()}
        className="text-green-600 dark:text-green-400"
      />
      <Stat
        icon={<TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
        label="ממוצע חודשי"
        value={avgMonths.toFixed(1)}
      />
      {needsReorder > 0 && (
        <Stat
          icon={<ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          label="להזמנה"
          value={needsReorder.toString()}
          className="text-red-600 dark:text-red-400"
        />
      )}
      {withIssues > 0 && (
        <Stat
          icon={<Bug className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          label="תקלות"
          value={withIssues.toString()}
          className="text-amber-600 dark:text-amber-400"
        />
      )}
      {totalStockValue > 0 && (
        <Stat
          icon={<DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          label="שווי"
          value={`$${totalStockValue >= 1_000_000
            ? `${(totalStockValue / 1_000_000).toFixed(1)}M`
            : totalStockValue >= 1_000
            ? `${(totalStockValue / 1_000).toFixed(0)}K`
            : totalStockValue.toLocaleString()}`}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-card border border-border rounded-md ${className ?? ""}`}>
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
