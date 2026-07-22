import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CalendarClock, AlertTriangle, CheckCircle, ShoppingCart, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { format, addDays } from "date-fns";
import { InlineEditField } from "@/components/InlineEditField";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";

type SortKey = "status" | "name" | "sku" | "stock_qty" | "incoming_qty" | "monthly_sales_avg" | "days_until_stockout" | "lead_time_days" | "order_by_date";

const COLUMN_DEFS = [
  { id: "status",              label: "סטטוס",             sortField: "status" },
  { id: "name",                label: "מוצר",              sortField: "name" },
  { id: "stock_qty",           label: "מלאי",              sortField: "stock_qty" },
  { id: "incoming_qty",        label: "בדרך",              sortField: "incoming_qty" },
  { id: "active_orders",       label: "הזמנות פעילות" },
  { id: "monthly_sales_avg",   label: "מכירות/חודש",       sortField: "monthly_sales_avg" },
  { id: "days_until_stockout", label: "ימים לאזילה",       sortField: "days_until_stockout" },
  { id: "lead_time_days",      label: "Lead Time",          sortField: "lead_time_days" },
  { id: "order_by_date",       label: "צריך להזמין עד",    sortField: "order_by_date" },
] as const;

interface ReorderRow {
  id: string;
  name: string;
  sku: string;
  stock_qty: number;
  incoming_qty: number;
  monthly_sales_avg: number | null;
  lead_time_days: number | null;
  reorder_point: number | null;
  daily_sales: number;
  days_until_stockout: number | null;
  order_by_date: Date | null;
  status: "danger" | "warning" | "ok";
  has_active_order: boolean;
  active_order_qty: number;
}

export default function ReorderPage() {
  const { products, updateProduct, loading } = useData();
  const navigate = useNavigate();
  const { hasEdit } = usePermissions("reorder");

  const prefs = useTablePreferences("ReorderPage", {
    sortField: "status",
  });
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility("reorder:hidden-columns", COLUMN_DEFS);
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const sortKey = prefs.sortField as SortKey | null;
  const sortDir = prefs.sortDir;

  // Live data from actual orders
  const [liveIncoming, setLiveIncoming] = useState<Record<string, number>>({});
  const [activeOrderCount, setActiveOrderCount] = useState<Record<string, number>>({});
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchLiveData = useCallback(async () => {
    setFetching(true);
    const { data } = await supabase
      .from("order_items")
      .select("product_id, qty, orders!inner(status)")
      .not("product_id", "is", null)
      .in("orders.status", ["PENDING", "ORDERED", "SHIPPED", "ARRIVED_PORT", "CUSTOMS_CLEARANCE", "DELIVERED"]);

    if (data) {
      const incoming: Record<string, number> = {};
      const actives: Record<string, number> = {};
      for (const item of data as Array<{ product_id: string; qty: number }>) {
        if (!item.product_id) continue;
        incoming[item.product_id] = (incoming[item.product_id] || 0) + (item.qty || 0);
        actives[item.product_id] = (actives[item.product_id] || 0) + 1;
      }
      setLiveIncoming(incoming);
      setActiveOrderCount(actives);
    }
    setLastFetch(new Date());
    setFetching(false);
  }, []);

  useEffect(() => { fetchLiveData(); }, [fetchLiveData]);

  const rows = useMemo<ReorderRow[]>(() => {
    let result = products
      .map(p => {
        const monthlySales = p.monthly_sales_avg ?? p.monthly_sales ?? 0;
        const dailySales = monthlySales / 30;
        // Use live order data if available, fallback to stored field
        const incoming = liveIncoming[p.id] ?? p.incoming_qty;
        const totalStock = p.stock_qty + incoming;
        const daysUntilStockout = dailySales > 0 ? Math.floor(totalStock / dailySales) : null;
        const leadTime = p.lead_time_days ?? 30;
        const orderByDate = daysUntilStockout !== null ? addDays(new Date(), daysUntilStockout - leadTime) : null;

        let status: "danger" | "warning" | "ok" = "ok";
        if (daysUntilStockout !== null) {
          if (daysUntilStockout <= leadTime) status = "danger";
          else if (p.reorder_point && totalStock <= p.reorder_point * 1.5) status = "warning";
          else if (daysUntilStockout <= leadTime * 2) status = "warning";
        }

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock_qty: p.stock_qty,
          incoming_qty: incoming,
          monthly_sales_avg: monthlySales,
          lead_time_days: p.lead_time_days,
          reorder_point: p.reorder_point,
          daily_sales: dailySales,
          days_until_stockout: daysUntilStockout,
          order_by_date: orderByDate,
          status,
          has_active_order: (activeOrderCount[p.id] || 0) > 0,
          active_order_qty: activeOrderCount[p.id] || 0,
        } as ReorderRow;
      })
      .filter(r => r.daily_sales > 0);

    // Apply sorting
    if (sortKey && sortDir) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "status": {
            const order = { danger: 0, warning: 1, ok: 2 };
            cmp = order[a.status] - order[b.status];
            break;
          }
          case "name":
            cmp = a.name.localeCompare(b.name, "he");
            break;
          case "sku":
            cmp = a.sku.localeCompare(b.sku, "he");
            break;
          case "stock_qty":
            cmp = a.stock_qty - b.stock_qty;
            break;
          case "incoming_qty":
            cmp = a.incoming_qty - b.incoming_qty;
            break;
          case "monthly_sales_avg":
            cmp = (a.monthly_sales_avg || 0) - (b.monthly_sales_avg || 0);
            break;
          case "days_until_stockout":
            cmp = (a.days_until_stockout ?? 999) - (b.days_until_stockout ?? 999);
            break;
          case "lead_time_days":
            cmp = (a.lead_time_days ?? 0) - (b.lead_time_days ?? 0);
            break;
          case "order_by_date":
            cmp = (a.order_by_date?.getTime() ?? 0) - (b.order_by_date?.getTime() ?? 0);
            break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    } else {
      // Default sort: by status then days_until_stockout
      result = [...result].sort((a, b) => {
        const order = { danger: 0, warning: 1, ok: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return (a.days_until_stockout ?? 999) - (b.days_until_stockout ?? 999);
      });
    }

    return result;
  }, [products, sortKey, sortDir, liveIncoming, activeOrderCount]);

  const dangerCount = rows.filter(r => r.status === "danger").length;
  const warningCount = rows.filter(r => r.status === "warning").length;

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  const statusIcon = (s: string) => {
    if (s === "danger") return <span className="text-destructive">🔴</span>;
    if (s === "warning") return <span className="text-warning">🟡</span>;
    return <span className="text-success">🟢</span>;
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const handleLeadTimeUpdate = async (productId: string, value: string) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0) return;
    try {
      await updateProduct(productId, { lead_time_days: num });
      toast.success("Lead Time עודכן");
    } catch {
      // error toast already shown by AppContext
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarClock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">תכנון רכש חכם</h1>
        <div className="ms-auto flex items-center gap-2">
          {lastFetch && (
            <span className="text-xs text-muted-foreground">
              עודכן {lastFetch.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchLiveData} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 ml-1 ${fetching ? "animate-spin" : ""}`} />
            רענן
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">⚡ צריך להזמין עכשיו</p>
          <p className="text-3xl font-bold text-destructive flex items-center justify-center gap-1">
            {dangerCount > 0 && <AlertTriangle className="h-6 w-6" />}{dangerCount}
          </p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">🟡 קרוב לנקודת הזמנה</p>
          <p className="text-3xl font-bold text-warning">{warningCount}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">🟢 מלאי תקין</p>
          <p className="text-3xl font-bold text-success flex items-center justify-center gap-1">
            <CheckCircle className="h-6 w-6" />{rows.filter(r => r.status === "ok").length}
          </p>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין מוצרים עם נתוני מכירות לחישוב</p>
        ) : rows.map(r => (
          <div key={r.id} className={`bg-card rounded-xl border shadow-sm p-4 ${r.status === "danger" ? "border-destructive/40 bg-destructive/5" : r.status === "warning" ? "border-warning/40 bg-warning/5" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="text-lg mt-0.5 shrink-0">{statusIcon(r.status)}</span>
                <div className="min-w-0">
                  <button onClick={() => navigate(`/products/${r.id}`)} className="text-primary font-semibold text-base hover:underline text-right block truncate w-full">
                    {r.name}
                  </button>
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">{r.sku}</p>
                </div>
              </div>
              {r.has_active_order && (
                <span className="text-xs font-medium text-success bg-success/15 px-2 py-0.5 rounded-full shrink-0">
                  {r.active_order_qty} פעיל{r.active_order_qty > 1 ? "ות" : "ה"}
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">מלאי</p>
                <p className="font-bold text-foreground">{r.stock_qty}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">בדרך</p>
                <p className="text-muted-foreground">{r.incoming_qty || "—"}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">ימים לאזילה</p>
                <p className={`font-bold ${r.status === "danger" ? "text-destructive" : r.status === "warning" ? "text-warning" : "text-foreground"}`}>
                  {r.days_until_stockout !== null ? r.days_until_stockout : "—"}
                </p>
              </div>
            </div>
            {r.order_by_date && (
              <p className="text-xs text-muted-foreground mt-2">
                הזמן עד:{" "}
                <span className={`font-medium ${r.status === "danger" ? "text-destructive" : "text-foreground"}`}>
                  {format(r.order_by_date, "dd/MM/yyyy")}
                </span>
              </p>
            )}
            {hasEdit && r.status === "danger" && (
              <Button
                size="sm"
                variant="outline"
                className={`w-full mt-3 text-xs ${r.has_active_order ? "border-warning/50 text-warning hover:bg-warning/10" : "border-destructive/50 text-destructive hover:bg-destructive/10"}`}
                onClick={() => navigate(`/orders?create=true&product=${r.id}`)}
              >
                <ShoppingCart className="h-3.5 w-3.5 ml-1.5" />
                {r.has_active_order ? "הזמן שוב" : "הזמן עכשיו"}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Reorder Table */}
      <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
              {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                  {col.sortField ? (
                    <button onClick={() => prefs.toggleSort(col.sortField!)} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
                      {col.label} <SortIcon col={col.sortField as SortKey} />
                    </button>
                  ) : col.label}
                </th>
              ) : null)}
              {hasEdit && <th className="text-right p-3 font-semibold text-foreground">פעולה</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={visibleCount + (hasEdit ? 1 : 0)} className="p-8 text-center text-muted-foreground">אין מוצרים עם נתוני מכירות לחישוב</td></tr>
            ) : (
              rows.map(r => (
                <tr key={r.id} className={`hover:bg-muted/30 transition-colors ${r.status === "danger" ? "bg-destructive/5" : r.status === "warning" ? "bg-warning/5" : ""}`}>
                  {isVisible("status") && <td className="p-3 text-center text-lg">{statusIcon(r.status)}</td>}
                  {isVisible("name") && (
                    <td className="p-3">
                      <button onClick={() => navigate(`/products/${r.id}`)} className="text-primary hover:underline">
                        <p className="font-medium">{r.name}</p>
                      </button>
                      <p className="text-xs text-muted-foreground font-mono" dir="ltr">{r.sku}</p>
                    </td>
                  )}
                  {isVisible("stock_qty") && <td className="p-3 text-foreground font-semibold">{r.stock_qty}</td>}
                  {isVisible("incoming_qty") && <td className="p-3 text-muted-foreground">{r.incoming_qty}</td>}
                  {isVisible("active_orders") && (
                    <td className="p-3">
                      {r.has_active_order ? (
                        <span className="text-xs font-medium text-success bg-success/15 px-2 py-0.5 rounded-full">
                          {r.active_order_qty} פעיל{r.active_order_qty > 1 ? "ות" : "ה"}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                  {isVisible("monthly_sales_avg") && <td className="p-3 text-muted-foreground">{r.monthly_sales_avg?.toFixed(0) || "—"}</td>}
                  {isVisible("days_until_stockout") && (
                    <td className="p-3">
                      <span className={`font-bold ${r.status === "danger" ? "text-destructive" : r.status === "warning" ? "text-warning" : "text-foreground"}`}>
                        {r.days_until_stockout !== null ? `${r.days_until_stockout} ימים` : "—"}
                      </span>
                    </td>
                  )}
                  {isVisible("lead_time_days") && (
                    <td className="p-3">
                      {hasEdit ? (
                        <InlineEditField
                          value={r.lead_time_days?.toString() || ""}
                          onSave={(v) => handleLeadTimeUpdate(r.id, v)}
                          type="number"
                          displayValue={
                            <span className="text-muted-foreground">{r.lead_time_days ? `${r.lead_time_days} ימים` : "—"}</span>
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground">{r.lead_time_days ? `${r.lead_time_days} ימים` : "—"}</span>
                      )}
                    </td>
                  )}
                  {isVisible("order_by_date") && (
                    <td className="p-3 text-xs">
                      {r.order_by_date ? (
                        <span className={`font-medium ${r.status === "danger" ? "text-destructive" : "text-foreground"}`}>
                          {format(r.order_by_date, "dd/MM/yyyy")}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  {hasEdit && (
                    <td className="p-3">
                      {r.status === "danger" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs h-7 ${r.has_active_order
                            ? "border-warning/50 text-warning hover:bg-warning/10"
                            : "border-destructive/50 text-destructive hover:bg-destructive/10"}`}
                          onClick={() => navigate(`/orders?create=true&product=${r.id}`)}
                        >
                          <ShoppingCart className="h-3 w-3 ml-1" />
                          {r.has_active_order ? "הזמן שוב" : "הזמן"}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={prefs.sortField}
          sortDir={prefs.sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => prefs.savePreferences({ sortField: field, sortDir: "asc" })}
          onSortDesc={field => prefs.savePreferences({ sortField: field, sortDir: "desc" })}
        />
      )}

      <p className="text-xs text-muted-foreground text-center">
        * החישוב מבוסס על: ימים לאזילה = (מלאי + בדרך) ÷ מכירות יומיות | תאריך הזמנה = היום + ימים לאזילה - Lead Time | "בדרך" מחושב מהזמנות פעילות בזמן אמת
      </p>
    </div>
  );
}
