import { useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import type { OrderStatus } from "@/data/mockData";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "ORDERED",
  ORDERED: "SHIPPED",
  SHIPPED: "ARRIVED",
};

export default function OrdersPage() {
  const { orders, updateOrderStatus } = useData();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">הזמנות</h1>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">עדיפות</th>
              <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">כמות</th>
              <th className="text-right p-3 font-semibold text-foreground">ספק</th>
              <th className="text-right p-3 font-semibold text-foreground">משלוח</th>
              <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
              <th className="text-right p-3 font-semibold text-foreground">ETA</th>
              <th className="text-right p-3 font-semibold text-foreground">פעולה</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">אין הזמנות</td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id}>
                  <td className="p-3"><PriorityBadge priority={order.priority} /></td>
                  <td className="p-3 font-medium text-foreground">{order.items.map(i => i.name).join(", ")}</td>
                  <td className="p-3 text-muted-foreground">{order.items.reduce((s, i) => s + i.qty, 0)}</td>
                  <td className="p-3 text-muted-foreground">{order.supplierName || "—"}</td>
                  <td className="p-3 text-muted-foreground">{order.shipping || "—"}</td>
                  <td className="p-3"><OrderStatusBadge status={order.status} /></td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}
                  </td>
                  <td className="p-3">
                    {nextStatus[order.status] && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1"
                        onClick={() => updateOrderStatus(order.id, nextStatus[order.status]!)}
                      >
                        קדם סטטוס
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
