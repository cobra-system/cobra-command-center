import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth } from "@/contexts/AppContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, AlertTriangle, CheckCircle, ShoppingCart } from "lucide-react";
import { format, addDays } from "date-fns";
import { InlineEditField } from "@/components/InlineEditField";
import { toast } from "sonner";

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
}

export default function ReorderPage() {
  const { products, updateProduct, loading } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isManager = currentUser?.role === "MANAGER";

  const rows = useMemo<ReorderRow[]>(() => {
    return products
      .map(p => {
        const monthlySales = p.monthly_sales_avg ?? p.monthly_sales ?? 0;
        const dailySales = monthlySales / 30;
        const totalStock = p.stock_qty + p.incoming_qty;
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
          incoming_qty: p.incoming_qty,
          monthly_sales_avg: monthlySales,
          lead_time_days: p.lead_time_days,
          reorder_point: p.reorder_point,
          daily_sales: dailySales,
          days_until_stockout: daysUntilStockout,
          order_by_date: orderByDate,
          status,
        } as ReorderRow;
      })
      .filter(r => r.daily_sales > 0)
      .sort((a, b) => {
        const order = { danger: 0, warning: 1, ok: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return (a.days_until_stockout ?? 999) - (b.days_until_stockout ?? 999);
      });
  }, [products]);

  const dangerCount = rows.filter(r => r.status === "danger").length;
  const warningCount = rows.filter(r => r.status === "warning").length;

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  const statusIcon = (s: string) => {
    if (s === "danger") return <span className="text-destructive">🔴</span>;
    if (s === "warning") return <span className="text-warning">🟡</span>;
    return <span className="text-success">🟢</span>;
  };

  const handleLeadTimeUpdate = async (productId: string, value: string) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0) return;
    await updateProduct(productId, { lead_time_days: num });
    toast.success("Lead Time עודכן");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">תכנון רכש חכם</h1>
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

      {/* Reorder Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
              <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">מלאי</th>
              <th className="text-right p-3 font-semibold text-foreground">בדרך</th>
              <th className="text-right p-3 font-semibold text-foreground">מכירות/חודש</th>
              <th className="text-right p-3 font-semibold text-foreground">ימים לאזילה</th>
              <th className="text-right p-3 font-semibold text-foreground">Lead Time</th>
              <th className="text-right p-3 font-semibold text-foreground">צריך להזמין עד</th>
              {isManager && <th className="text-right p-3 font-semibold text-foreground">פעולה</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={isManager ? 9 : 8} className="p-8 text-center text-muted-foreground">אין מוצרים עם נתוני מכירות לחישוב</td></tr>
            ) : (
              rows.map(r => (
                <tr key={r.id} className={`hover:bg-muted/30 transition-colors ${r.status === "danger" ? "bg-destructive/5" : r.status === "warning" ? "bg-warning/5" : ""}`}>
                  <td className="p-3 text-center text-lg">{statusIcon(r.status)}</td>
                  <td className="p-3">
                    <button onClick={() => navigate(`/products/${r.id}`)} className="text-primary hover:underline">
                      <p className="font-medium">{r.name}</p>
                    </button>
                    <p className="text-xs text-muted-foreground font-mono" dir="ltr">{r.sku}</p>
                  </td>
                  <td className="p-3 text-foreground font-semibold">{r.stock_qty}</td>
                  <td className="p-3 text-muted-foreground">{r.incoming_qty}</td>
                  <td className="p-3 text-muted-foreground">{r.monthly_sales_avg?.toFixed(0) || "—"}</td>
                  <td className="p-3">
                    <span className={`font-bold ${r.status === "danger" ? "text-destructive" : r.status === "warning" ? "text-warning" : "text-foreground"}`}>
                      {r.days_until_stockout !== null ? `${r.days_until_stockout} ימים` : "—"}
                    </span>
                  </td>
                  <td className="p-3">
                    {isManager ? (
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
                  <td className="p-3 text-xs">
                    {r.order_by_date ? (
                      <span className={`font-medium ${r.status === "danger" ? "text-destructive" : "text-foreground"}`}>
                        {format(r.order_by_date, "dd/MM/yyyy")}
                      </span>
                    ) : "—"}
                  </td>
                  {isManager && (
                    <td className="p-3">
                      {r.status === "danger" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => navigate(`/orders?create=true&product=${r.id}`)}
                        >
                          <ShoppingCart className="h-3 w-3 ml-1" />הזמן
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

      <p className="text-xs text-muted-foreground text-center">
        * החישוב מבוסס על: ימים לאזילה = (מלאי + בדרך) ÷ מכירות יומיות | תאריך הזמנה = היום + ימים לאזילה - Lead Time
      </p>
    </div>
  );
}
