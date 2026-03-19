import { useNavigate } from "react-router-dom";
import { PriorityBadge } from "@/components/PriorityBadge";
import { type Priority, type Order, type Supplier } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Package, Calendar, DollarSign, Truck } from "lucide-react";

interface WorkflowInfo {
  id: string;
  status: string;
  current_step: number;
  steps: { name: string }[];
}

interface OrdersMapViewProps {
  orders: Order[];
  orderWorkflows: Record<string, WorkflowInfo>;
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
  "שולם פיקדון": "bg-amber-100 text-amber-700",
  "ממתין": "bg-gray-100 text-gray-500",
};

export function OrdersMapView({ orders, orderWorkflows, suppliers }: OrdersMapViewProps) {
  const navigate = useNavigate();

  // Group orders into Kanban columns based on workflow status
  const columns: KanbanColumn[] = (() => {
    const noWorkflow: Order[] = [];
    const waiting: Order[] = [];
    const inProgress: Order[] = [];
    const completed: Order[] = [];

    orders.forEach(order => {
      const wf = orderWorkflows[order.id];
      if (!wf) {
        noWorkflow.push(order);
      } else if (wf.status === "completed") {
        completed.push(order);
      } else if (wf.current_step === 0) {
        waiting.push(order);
      } else {
        inProgress.push(order);
      }
    });

    return [
      { key: "waiting", title: "ממתין", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", orders: waiting },
      { key: "in_progress", title: "בתהליך", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", orders: inProgress },
      { key: "completed", title: "הושלם", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200", orders: completed },
      { key: "no_workflow", title: "ללא תהליך", color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200", orders: noWorkflow },
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
              const wf = orderWorkflows[order.id];
              const paymentStatus = (order as any).payment_status || "ממתין";
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
                        {new Date(order.eta).toLocaleDateString("he-IL")}
                      </span>
                    )}
                    {order.total_price ? (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {order.total_price.toLocaleString()}
                      </span>
                    ) : null}
                  </div>

                  {/* Workflow progress */}
                  {wf && wf.steps.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span className="truncate max-w-[150px]">
                          {wf.status === "completed"
                            ? "הושלם"
                            : wf.steps[wf.current_step]?.name || `שלב ${wf.current_step + 1}`}
                        </span>
                        <span>{wf.status === "completed" ? wf.steps.length : wf.current_step}/{wf.steps.length}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            wf.status === "completed" ? "bg-emerald-500" : "bg-blue-500"
                          )}
                          style={{ width: `${(wf.status === "completed" ? 100 : (wf.current_step / wf.steps.length) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

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
