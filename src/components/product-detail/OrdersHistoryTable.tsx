import { useNavigate } from "react-router-dom";
import { TruckIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import type { Order, Product, Priority, OrderStatus } from "@/contexts/AppContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { format } from "date-fns";
import { useColumnVisibility, defineColumns } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";

const COLUMN_DEFS = defineColumns([
    { id: "priority", label: "עדיפות" },
    { id: "supplier", label: "ספק" },
    { id: "qty", label: "כמות" },
    { id: "status", label: "סטטוס" },
    { id: "eta", label: "ETA" },
    { id: "etd", label: "ETD" },
    { id: "order_date", label: "תאריך הזמנה" },
    { id: "pi_number", label: "PI" },
    { id: "vessel_name", label: "כלי שיט" },
    { id: "tracking_number", label: "מעקב" },
    { id: "total_price", label: "מחיר" },
    { id: "notes", label: "הערות" },
]);

const DEFAULT_HIDDEN = ["etd", "order_date", "vessel_name", "tracking_number", "total_price", "notes"];

interface OrdersHistoryTableProps {
  relatedOrders: Order[];
  product: Product;
  hasEdit: boolean;
}

export function OrdersHistoryTable({ relatedOrders, product, hasEdit }: OrdersHistoryTableProps) {
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "product-orders-history:hidden-columns",
    COLUMN_DEFS,
    DEFAULT_HIDDEN
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  return (
    <>
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
                  <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
                    {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                      <th
                        key={col.id}
                        className="text-right p-3 font-semibold text-foreground"
                        onContextMenu={colThContextMenu(col, setColMenu)}
                      >
                        {col.label}
                      </th>
                    ) : null)}
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
                        {isVisible("priority") && <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>}
                        {isVisible("supplier") && <td className="p-3 text-muted-foreground">{order.supplier_name || "—"}</td>}
                        {isVisible("qty") && <td className="p-3 text-muted-foreground">{relevantItem?.qty || "—"}</td>}
                        {isVisible("status") && <td className="p-3"><OrderStatusBadge status={order.status as OrderStatus} /></td>}
                        {isVisible("eta") && <td className="p-3 text-muted-foreground text-xs">{order.eta ? format(new Date(order.eta), "dd/MM/yyyy") : "—"}</td>}
                        {isVisible("etd") && <td className="p-3 text-muted-foreground text-xs">{order.etd ? format(new Date(order.etd), "dd/MM/yyyy") : "—"}</td>}
                        {isVisible("order_date") && <td className="p-3 text-muted-foreground text-xs">{order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy") : "—"}</td>}
                        {isVisible("pi_number") && <td className="p-3 text-muted-foreground text-xs">{order.pi_number || "—"}</td>}
                        {isVisible("vessel_name") && <td className="p-3 text-muted-foreground text-xs">{order.vessel_name || "—"}</td>}
                        {isVisible("tracking_number") && <td className="p-3 text-muted-foreground text-xs">{order.tracking_number || "—"}</td>}
                        {isVisible("total_price") && <td className="p-3 text-muted-foreground text-xs">{order.total_price != null ? formatPrice(order.total_price) : "—"}</td>}
                        {isVisible("notes") && <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{order.notes || "—"}</td>}
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

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={undefined}
          sortDir={undefined}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={() => {}}
          onSortDesc={() => {}}
        />
      )}
    </>
  );
}
