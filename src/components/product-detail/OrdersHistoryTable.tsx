import { useNavigate } from "react-router-dom";
import { TruckIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import type { Order, Product, Priority, OrderStatus } from "@/contexts/AppContext";

import { format } from "date-fns";
interface OrdersHistoryTableProps {
  relatedOrders: Order[];
  product: Product;
  hasEdit: boolean;
}

export function OrdersHistoryTable({ relatedOrders, product, hasEdit }: OrdersHistoryTableProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TruckIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">היסטוריית הזמנות</h2>
        </div>
        {hasEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/orders?newOrder=true&productId=${product.id}`)}
            data-navigate-to={`/orders?newOrder=true&productId=${product.id}`}
          >
            <Plus className="h-3.5 w-3.5 ml-1" />הוסף הזמנה
          </Button>
        )}
      </div>
      {relatedOrders.length > 0 ? (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {relatedOrders.map(order => {
              const relevantItem = order.items.find(i => i.name === product.name || i.product_id === product.id);
              return (
                <div
                  key={order.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/orders/${order.id}`)}
                  data-navigate-to={`/orders/${order.id}`}
                >
                  <PriorityBadge priority={order.priority as Priority} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{order.supplier_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">כמות: {relevantItem?.qty || "—"}</p>
                  </div>
                  <div className="shrink-0 text-left">
                    <OrderStatusBadge status={order.status as OrderStatus} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.eta ? format(new Date(order.eta), "dd/MM/yyyy") : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">עדיפות</th>
                <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                <th className="text-right p-3 font-semibold text-foreground">כמות</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                <th className="text-right p-3 font-semibold text-foreground">ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {relatedOrders.map(order => {
                const relevantItem = order.items.find(i => i.name === product.name || i.product_id === product.id);
                return (
                  <tr
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/orders/${order.id}`)}
                    data-navigate-to={`/orders/${order.id}`}
                  >
                    <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                    <td className="p-3 text-muted-foreground">{order.supplier_name || "—"}</td>
                    <td className="p-3 text-muted-foreground">{relevantItem?.qty || "—"}</td>
                    <td className="p-3"><OrderStatusBadge status={order.status as OrderStatus} /></td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {order.eta ? format(new Date(order.eta), "dd/MM/yyyy") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">אין הזמנות קשורות למוצר זה</p>
      )}
    </div>
  );
}
