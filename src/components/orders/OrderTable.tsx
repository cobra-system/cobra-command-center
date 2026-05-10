import { useNavigate } from "react-router-dom";
import { type Order, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Trash2, Copy, ArrowUpDown, ArrowUp, ArrowDown, Eye, RefreshCw, Truck, ShoppingCart } from "lucide-react";
import { EntityContextMenu, type ContextMenuGroupItem } from "@/components/EntityContextMenu";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Priority } from "@/contexts/AppContext";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useProductScope } from "@/hooks/useProductScope";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import { TrackingBadge } from "@/components/orders/TrackingBadge";
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";
import { detectCarrier, carrierLabel } from "@/lib/trackingCarrierDetect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { TableSelectionState } from "@/hooks/useTableSelection";

import { format } from "date-fns";
export type SortField = "priority" | "product" | "qty" | "supplier" | "shipping" | "status" | "order_date" | "etd" | "eta" | "total_price" | "payment" | "tracking_number" | "tracking_status" | "tracking_carrier" | "updated_at" | "pi_number";
export type SortDir = "asc" | "desc" | null;

// ─── Column configuration ────────────────────────────────────────────────────
const COLUMN_DEFS: ColDef[] = [
  { id: "priority",        label: "עדיפות",        sortField: "priority" },
  { id: "product",         label: "מוצר",           sortField: "product" },
  { id: "qty",             label: "כמות",           sortField: "qty" },
  { id: "supplier",        label: "ספק",            sortField: "supplier" },
  { id: "shipping",        label: "משלוח",          sortField: "shipping" },
  { id: "status",          label: "סטטוס",          sortField: "status" },
  { id: "order_date",      label: "תאריך הזמנה",    sortField: "order_date" },
  { id: "etd",             label: "ETD",             sortField: "etd" },
  { id: "eta",             label: "ETA",             sortField: "eta" },
  { id: "total_price",     label: "סה״כ",           sortField: "total_price" },
  { id: "payment",         label: "תשלום",          sortField: "payment" },
  { id: "tracking_number", label: "מספר מעקב",      sortField: "tracking_number" },
  { id: "tracking_carrier", label: "חברת שילוח",    sortField: "tracking_carrier" },
  { id: "tracking_status", label: "מצב מעקב DHL",   sortField: "tracking_status" },
  { id: "pi_number",       label: "PI Number",       sortField: "pi_number" },
  { id: "updated_at",      label: "עודכן לאחרונה",  sortField: "updated_at" },
];

// ─── Props ───────────────────────────────────────────────────────────────────
const PRICE_COLS = new Set(["total_price", "payment", "pi_number"]);

interface OrderTableProps {
  filtered: Order[];
  orderPaymentStatuses: Record<string, string>;
  hasEdit: boolean;
  sortField: SortField | null;
  sortDir: SortDir;
  toggleSort: (field: SortField) => void;
  setSort: (field: SortField, dir: "asc" | "desc") => void;
  allStatuses: { value: OrderStatus; label: string }[];
  navigateToSupplier: (supplierName: string, e?: React.MouseEvent) => void;
  navigateToProduct: (productId: string, e?: React.MouseEvent) => void;
  handleDeleteOrder: (orderId: string, e?: React.MouseEvent) => void;
  handleDuplicateOrder: (orderId: string, e?: React.MouseEvent) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  selection?: TableSelectionState;
  hidePrices?: boolean;
}

// ─── Sort icon ───────────────────────────────────────────────────────────────
const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
};

// ─── Main component ──────────────────────────────────────────────────────────
export function OrderTable({
  filtered,
  orderPaymentStatuses,
  hasEdit,
  sortField,
  sortDir,
  toggleSort,
  setSort,
  allStatuses,
  navigateToSupplier,
  navigateToProduct,
  handleDeleteOrder,
  handleDuplicateOrder,
  updateOrderStatus,
  updateOrder,
  selection,
  hidePrices,
}: OrderTableProps) {
  const navigate = useNavigate();
  const colVis = useColumnVisibility("orders:hidden-columns", COLUMN_DEFS, ["total_price", "pi_number"]);
  const isVisible = (id: string) => hidePrices && PRICE_COLS.has(id) ? false : colVis.isVisible(id);
  const { hide, show, hiddenCols, visibleCount } = colVis;
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();
  const { scopeOrderItems } = useProductScope();

  const totalColSpan = visibleCount + 2 + (hasEdit ? 1 : 0) + (selection ? 1 : 0);
  const allFilteredIds = filtered.map(o => o.id);

  return (
    <>
      {/* ── Mobile card list (hidden on md+) ─────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">אין הזמנות להצגה</p>
            <p className="text-xs text-muted-foreground">נסה לשנות את הסינון או לחפש שם אחר</p>
          </div>
        ) : filtered.map(order => {
          const paymentStatus = orderPaymentStatuses[order.id] || "ממתין";
          const paymentColors: Record<string, string> = {
            "שולם": "bg-success/15 text-success",
            "שולם חלקי": "bg-accent/15 text-accent",
            "ממתין": "bg-warning/15 text-warning",
          };
          return (
            <div
              key={order.id}
              className="bg-card rounded-xl border p-4 space-y-3 cursor-pointer active:bg-muted/50 transition-colors"
              onClick={() => navigate(`/orders/${order.id}`)}
              data-navigate-to={`/orders/${order.id}`}
            >
              {/* Items + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm line-clamp-2">
                    {(() => {
                      const visibleItems = scopeOrderItems(order.items);
                      return visibleItems.length === 0 ? "ללא פריטים" : visibleItems.map(i => i.name).join(", ");
                    })()}
                  </p>
                  {order.supplier_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">{order.supplier_name}</p>
                  )}
                </div>
                <OrderStatusBadge status={order.status as OrderStatus} />
              </div>

              {/* Priority + payment + total */}
              <div className="flex items-center gap-2 flex-wrap">
                <PriorityBadge priority={order.priority as Priority} />
                <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", paymentColors[paymentStatus] || "bg-muted text-muted-foreground")}>
                  {paymentStatus}
                </span>
                {order.total_price && (
                  <span className="ms-auto text-sm font-semibold text-foreground">${order.total_price.toLocaleString()}</span>
                )}
              </div>

              {/* ETA + tracking */}
              {(order.eta || order.tracking_number) && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {order.eta && <span>ETA: {format(new Date(order.eta), "dd/MM/yyyy")}</span>}
                  {order.tracking_number && <span className="font-mono truncate">{order.tracking_number}</span>}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/50" onClick={e => e.stopPropagation()}>
                <PhotoCaptureButton
                  imageUrl={order.order_image}
                  storagePath={`orders/${order.id}`}
                  onSave={async (url) => { await updateOrder(order.id, { order_image: url }); }}
                  disabled={!hasEdit}
                />
                <button
                  className="p-2 rounded-lg hover:bg-muted transition-colors ms-auto"
                  title="שכפל הזמנה"
                  onClick={(e) => handleDuplicateOrder(order.id, e)}
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
                {hasEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>מחיקת הזמנה</AlertDialogTitle>
                        <AlertDialogDescription>האם למחוק את ההזמנה? פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => handleDeleteOrder(order.id, e)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (hidden on mobile) ─────────────────────────────── */}
      <div className="hidden md:block">
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto" dir="rtl">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr
              className="border-b bg-muted/50"
              onContextMenu={trContextMenu(hiddenCols, setColMenu)}
            >
              {selection && (
                <th className="text-right p-3 font-semibold text-foreground w-10">
                  <Checkbox
                    aria-label="בחר הכל"
                    checked={selection.isAllSelected(allFilteredIds) ? true : selection.isPartiallySelected(allFilteredIds) ? "indeterminate" : false}
                    onCheckedChange={() => selection.selectAll(allFilteredIds)}
                  />
                </th>
              )}
              {COLUMN_DEFS.map(col => {
                if (!isVisible(col.id)) return null;
                return (
                  <th
                    key={col.id}
                    className="text-right p-3 font-semibold text-foreground"
                    onContextMenu={colThContextMenu(col, setColMenu)}
                  >
                    <button
                      onClick={() => toggleSort(col.sortField)}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      {col.label}
                      <SortIcon field={col.sortField} sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                );
              })}
              <th className="w-10" />
              <th className="w-10" />
              {hasEdit && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={totalColSpan} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">אין הזמנות להצגה</p>
                </div>
              </td></tr>
            ) : filtered.map((order) => {
              const orderMenuGroups: ContextMenuGroupItem[][] = [
                [
                  { label: "צפה בהזמנה", icon: Eye, onClick: () => navigate(`/orders/${order.id}`) },
                  { label: `עבור לספק: ${order.supplier_name}`, icon: Truck, onClick: () => navigateToSupplier(order.supplier_name!), hidden: !order.supplier_name },
                ],
                [
                  {
                    label: "שנה סטטוס", icon: RefreshCw, hidden: !hasEdit,
                    items: allStatuses.map(s => ({
                      label: s.label, onClick: () => updateOrderStatus(order.id, s.value),
                      disabled: order.status === s.value,
                    })),
                  },
                ],
                [
                  { label: "שכפל הזמנה", icon: Copy, onClick: () => handleDuplicateOrder(order.id) },
                  { label: "העתק מספר מעקב", icon: Copy, onClick: () => { navigator.clipboard.writeText(order.tracking_number!); toast.success("מספר המעקב הועתק"); }, hidden: !order.tracking_number },
                ],
                [
                  { label: "מחק הזמנה", icon: Trash2, onClick: () => handleDeleteOrder(order.id), variant: "destructive" as const, hidden: !hasEdit, confirmTitle: "מחיקת הזמנה", confirmDescription: "האם למחוק את ההזמנה? פעולה זו לא ניתנת לביטול." },
                ],
              ];
              return (
                <EntityContextMenu key={order.id} groups={orderMenuGroups}>
                  <tr
                    className={cn(
                      "cursor-pointer hover:bg-muted/30 transition-colors",
                      selection?.isSelected(order.id) && "bg-primary/5",
                    )}
                    onClick={(e) => { if (e.detail !== 1) return; navigate(`/orders/${order.id}`); }}
                    data-navigate-to={`/orders/${order.id}`}
                  >
                    {selection && (
                      <td className="p-3 w-10" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          aria-label="בחר הזמנה"
                          checked={selection.isSelected(order.id)}
                          onCheckedChange={() => selection.toggle(order.id)}
                        />
                      </td>
                    )}
                    {isVisible("priority") && (
                      <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                    )}
                    {isVisible("product") && (
                      <td className="p-3 font-medium text-foreground max-w-[200px] truncate" onClick={e => e.stopPropagation()}>
                        {(() => {
                          const visibleItems = scopeOrderItems(order.items);
                          return visibleItems.length === 0 ? (
                            <span className="text-muted-foreground italic text-xs">ללא פריטים</span>
                          ) : visibleItems.map((i, idx) => (
                            <span key={idx}>
                              {i.product_id ? (
                                <button onClick={(e) => navigateToProduct(i.product_id!, e)} className="text-primary hover:underline text-sm">
                                  {i.name}
                                </button>
                              ) : (
                                <span>{i.name}</span>
                              )}
                              {idx < visibleItems.length - 1 && <span>, </span>}
                            </span>
                          ));
                        })()}
                      </td>
                    )}
                    {isVisible("qty") && (
                      <td className="p-3 text-muted-foreground">{scopeOrderItems(order.items).reduce((s, i) => s + i.qty, 0) || "—"}</td>
                    )}
                    {isVisible("supplier") && (
                      <td className="p-3">
                        {order.supplier_name ? (
                          <button onClick={(e) => navigateToSupplier(order.supplier_name!, e)} className="text-primary hover:underline text-sm">
                            {order.supplier_name}
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    )}
                    {isVisible("shipping") && (
                      <td className="p-3 text-muted-foreground">
                        {order.shipping === "בין ספקים" ? (
                          <span>
                            בין ספקים
                            {order.destination_supplier_name && (
                              <span className="text-xs block text-muted-foreground/70">→ {order.destination_supplier_name}</span>
                            )}
                          </span>
                        ) : (order.shipping || "—")}
                      </td>
                    )}
                    {isVisible("status") && (
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="cursor-pointer"><OrderStatusBadge status={order.status as OrderStatus} /></button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1" align="start">
                            <div className="flex flex-col gap-0.5">
                              {allStatuses.map(s => (
                                <button
                                  key={s.value}
                                  onClick={() => updateOrderStatus(order.id, s.value)}
                                  className={cn(
                                    "px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted",
                                    order.status === s.value && "bg-muted"
                                  )}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    )}
                    {isVisible("order_date") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy") : "—"}</td>
                    )}
                    {isVisible("etd") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.etd ? format(new Date(order.etd), "dd/MM/yyyy") : "—"}</td>
                    )}
                    {isVisible("eta") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.eta ? format(new Date(order.eta), "dd/MM/yyyy") : "—"}</td>
                    )}
                    {isVisible("total_price") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.total_price ? `$${order.total_price.toLocaleString()}` : "—"}</td>
                    )}
                    {isVisible("payment") && (
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        {(() => {
                          const ps = orderPaymentStatuses[order.id] || "ממתין";
                          const colors: Record<string, string> = {
                            "שולם": "bg-success/15 text-success",
                            "שולם חלקי": "bg-accent/15 text-accent",
                            "ממתין": "bg-warning/15 text-warning",
                          };
                          return <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", colors[ps] || "bg-muted text-muted-foreground")}>{ps}</span>;
                        })()}
                      </td>
                    )}
                    {isVisible("tracking_number") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.tracking_number || "—"}</td>
                    )}
                    {isVisible("tracking_carrier") && (
                      <td className="p-3 text-xs" onClick={e => e.stopPropagation()}>
                        {hasEdit && order.tracking_number && !order.tracking_carrier ? (
                          (() => {
                            const guess = detectCarrier(order.tracking_number, order.tclog_reference);
                            return (
                              <Select
                                value={order.tracking_carrier ?? ""}
                                onValueChange={(v) => updateOrder(order.id, { tracking_carrier: (v || null) as Order["tracking_carrier"] })}
                              >
                                <SelectTrigger className="h-7 text-xs w-28">
                                  <SelectValue placeholder={guess ? `${carrierLabel(guess.carrier)}?` : "בחר..."} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dhl">DHL</SelectItem>
                                  <SelectItem value="tclog">TCLOG</SelectItem>
                                  <SelectItem value="other">אחר</SelectItem>
                                </SelectContent>
                              </Select>
                            );
                          })()
                        ) : (
                          <span className={cn(order.tracking_carrier ? "text-foreground font-medium" : "text-muted-foreground")}>
                            {carrierLabel(order.tracking_carrier)}
                          </span>
                        )}
                      </td>
                    )}
                    {isVisible("tracking_status") && (
                      <td className="p-3 text-xs">
                        <TrackingBadge order={order} />
                      </td>
                    )}
                    {isVisible("pi_number") && (
                      <td className="p-3 text-muted-foreground text-xs font-mono">{order.pi_number || "—"}</td>
                    )}
                    {isVisible("updated_at") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.updated_at ? format(new Date(order.updated_at), "dd/MM/yyyy") : "—"}</td>
                    )}
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <PhotoCaptureButton
                        imageUrl={order.order_image}
                        storagePath={`orders/${order.id}`}
                        onSave={async (url) => { await updateOrder(order.id, { order_image: url }); }}
                        disabled={!hasEdit}
                      />
                    </td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <button
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="שכפל הזמנה"
                        onClick={(e) => handleDuplicateOrder(order.id, e)}
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </td>
                    {hasEdit && (
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-1 rounded hover:bg-destructive/10 transition-colors">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקת הזמנה</AlertDialogTitle>
                              <AlertDialogDescription>האם למחוק את ההזמנה? פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={(e) => handleDeleteOrder(order.id, e)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    )}
                  </tr>
                </EntityContextMenu>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>{/* end hidden md:block */}

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => setSort(field as SortField, "asc")}
          onSortDesc={field => setSort(field as SortField, "desc")}
        />
      )}
    </>
  );
}
