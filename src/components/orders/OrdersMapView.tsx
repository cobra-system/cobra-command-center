import { useNavigate } from "react-router-dom";
import { PriorityBadge } from "@/components/PriorityBadge";
import { type Priority, type Order, type Supplier } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Package, Calendar, DollarSign, Truck } from "lucide-react";

import { format } from "date-fns";
interface OrdersMapViewProps {
  orders: Order[];
  orderPaymentStatuses: Record<string, string>;
  suppliers: Supplier[];
}

interface KanbanColumn {
  key: string;
  title: string;
  color: string;
  bgColor: string;
  orders: Order[];
}

const priorityBorderColor: Record<string, string> = {
  "דחוף": "border-r-red-500",
  "גבוה": "border-r-orange-400",
  "בינוני": "border-r-blue-400",
  "נמוך": "border-r-gray-300",
};

const paymentColors: Record<string, string> = {
  "שולם": "bg-emerald-100 text-emerald-700",
  "שולם חלקי": "bg-amber-100 text-amber-700",
  "ממתין": "bg-gray-100 text-gray-500",
};

export function OrdersMapView({ orders, orderPaymentStatuses, suppliers }: OrdersMapViewProps) {
  const navigate = useNavigate();

  // Group orders into Kanban columns based on order status
  const columns: KanbanColumn[] = (() => {
    const pending: Order[] = [];
    const ordered: Order[] = [];
    const shipped: Order[] = [];
    const clearing: Order[] = [];

    orders.forEach(order => {
      if (order.status === "PENDING") pending.push(order);
      else if (order.status === "ORDERED") ordered.push(order);
      else if (order.status === "SHIPPED") shipped.push(order);
      else clearing.push(order);
    });

    return [
      { key: "pending",   title: "ממתין",       color: "text-amber-600",   bgColor: "bg-amber-50 border-amber-200",   orders: pending },
      { key: "ordered",   title: "הוזמן",        color: "text-blue-600",    bgColor: "bg-blue-50 border-blue-200",     orders: ordered },
      { key: "shipped",   title: "נשלח",         color: "text-violet-600",  bgColor: "bg-violet-50 border-violet-200", orders: shipped },
      { key: "clearing",  title: "נמל / מכס / נמסר", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200", orders: clearing },
    ];
  })();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map(col => (
        <div key={col.key} className="flex flex-col gap-3">
          {/* Column header */}
          <div className={cn("rounded-lg border px-4 py-2.5 flex items-center justify-between", col.bgColor)}>
            <span className={cn("font-semibold text-sm", col.color)}>{col.title}</span>
            <span className={cn("text-xs font-medium rounded-full px-2 py-0.5", col.bgColor, col.color)}>
              {col.orders.length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2.5 min-h-[200px]">
            {col.orders.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground border border-dashed rounded-lg">
                אין הזמנות
              </div>
            ) : col.orders.map(order => {
              const paymentStatus = orderPaymentStatuses[order.id] || "ממתין";
              const productNames = order.items.map(i => i.name).join(", ") || "ללא פריטים";
              const totalQty = order.items.reduce((s, i) => s + i.qty, 0);

              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className={cn(
                    "bg-card rounded-xl border border-r-4 p-3.5 cursor-pointer",
                    "hover:shadow-md hover:border-primary/30 transition-all duration-200",
                    priorityBorderColor[order.priority] || "border-r-gray-300"
                  )}
                >
                  {/* Header: Priority + Supplier */}
                  <div className="flex items-center justify-between mb-2">
                    <PriorityBadge priority={order.priority as Priority} />
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {order.supplier_name || "—"}
                    </span>
                  </div>

                  {/* Product name */}
                  <div className="flex items-start gap-1.5 mb-2.5">
                    <Package className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                      {productNames}
                    </span>
                  </div>

                  {/* Meta row: qty, ETA, price */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2.5">
                    {totalQty > 0 && (
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {totalQty}
                      </span>
                    )}
                    {order.eta && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new format(Date(order.eta), "dd/MM/yyyy")}
                      </span>
                    )}
                    {order.total_price ? (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {order.total_price.toLocaleString()}
                      </span>
                    ) : null}
                  </div>

                  {/* Payment badge */}
                  <div className="flex items-center justify-end">
                    <span className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full",
                      paymentColors[paymentStatus] || "bg-gray-100 text-gray-500"
                    )}>
                      {paymentStatus}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
