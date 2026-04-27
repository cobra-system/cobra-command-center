import { useNavigate } from "react-router-dom";
import { type Order, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Trash2, Copy, ArrowUpDown, ArrowUp, ArrowDown, Zap, CheckCircle, Eye, RefreshCw, CreditCard, Truck, ShoppingCart } from "lucide-react";
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
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";

export type SortField = "priority" | "product" | "qty" | "supplier" | "shipping" | "status" | "order_date" | "etd" | "eta" | "total_price" | "payment" | "workflow" | "tracking_number" | "tracking_status" | "updated_at" | "pi_number";
export type SortDir = "asc" | "desc" | null;

export interface WorkflowInfo {
  id: string;
  status: string;
  current_step: number;
  steps: { name: string }[];
}

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
  { id: "workflow",        label: "תהליך",          sortField: "workflow" },
  { id: "tracking_number", label: "מספר מעקב",      sortField: "tracking_number" },
  { id: "tracking_status", label: "מצב מעקב DHL",   sortField: "tracking_status" },
  { id: "pi_number",       label: "PI Number",       sortField: "pi_number" },
  { id: "updated_at",      label: "עודכן לאחרונה",  sortField: "updated_at" },
];

// ─── Props ───────────────────────────────────────────────────────────────────
interface OrderTableProps {
  filtered: Order[];
  orderWorkflows: Record<string, WorkflowInfo>;
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
  handleWorkflowStepChange: (orderId: string, wf: WorkflowInfo, newStep: number) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
}

// ─── Sort icon ───────────────────────────────────────────────────────────────
const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
};

// ─── Main component ──────────────────────────────────────────────────────────
export function OrderTable({
  filtered,
  orderWorkflows,
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
  handleWorkflowStepChange,
  updateOrderStatus,
  updateOrder,
}: OrderTableProps) {
  const navigate = useNavigate();
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility("orders:hidden-columns", COLUMN_DEFS, ["total_price", "pi_number"]);
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();
  const { scopeOrderItems } = useProductScope();

  const totalColSpan = visibleCount + 1 + (hasEdit ? 1 : 0);

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
          const paymentStatus = (order as Record<string, unknown>).payment_status as string || "ממתין";
          const paymentColors: Record<string, string> = {
            "שולם": "bg-success/15 text-success",
            "שולם פיקדון": "bg-accent/15 text-accent",
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
                  {order.eta && <span>ETA: {new Date(order.eta).toLocaleDateString("he-IL")}</span>}
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
              <th className="text-right p-3 font-semibold text-foreground w-10" />
              {hasEdit && <th className="text-right p-3 font-semibold text-foreground w-10" />}
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
              const isAlreadyPaid = (order as Record<string, unknown>).payment_status === "שולם";
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
                  {
                    label: "שנה סטטוס תשלום", icon: CreditCard, hidden: !hasEdit,
                    items: ["ממתין", "שולם פיקדון", "שולם"].map(ps => ({
                      label: ps, onClick: () => updateOrder(order.id, {
                        payment_status: ps,
                        payment_date: ps === "שולם" || ps === "שולם פיקדון" ? new Date().toISOString() : null,
                      } as Record<string, unknown>),
                      disabled: (order as Record<string, unknown>).payment_status === ps,
                    })),
                  },
                  { label: "סמן כשולם", icon: CheckCircle, onClick: () => updateOrder(order.id, { payment_status: "שולם", payment_date: new Date().toISOString() } as Record<string, unknown>), hidden: isAlreadyPaid || !hasEdit },
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
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={(e) => { if (e.detail !== 1) return; navigate(`/orders/${order.id}`); }}
                    data-navigate-to={`/orders/${order.id}`}
                  >
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
                      <td className="p-3 text-muted-foreground text-xs">{order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"}</td>
                    )}
                    {isVisible("etd") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.etd ? new Date(order.etd).toLocaleDateString("he-IL") : "—"}</td>
                    )}
                    {isVisible("eta") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}</td>
                    )}
                    {isVisible("total_price") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.total_price ? `$${order.total_price.toLocaleString()}` : "—"}</td>
                    )}
                    {isVisible("payment") && (
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="cursor-pointer">
                              {(() => {
                                const ps = (order as Record<string, unknown>).payment_status || "ממתין";
                                const colors: Record<string, string> = {
                                  "שולם": "bg-success/15 text-success",
                                  "שולם פיקדון": "bg-accent/15 text-accent",
                                  "ממתין": "bg-warning/15 text-warning",
                                };
                                return <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", colors[ps as string] || "bg-muted text-muted-foreground")}>{ps as string}</span>;
                              })()}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1" align="start">
                            <div className="flex flex-col gap-0.5">
                              {["ממתין", "שולם פיקדון", "שולם"].map(ps => (
                                <button
                                  key={ps}
                                  onClick={() => updateOrder(order.id, {
                                    payment_status: ps,
                                    payment_date: ps === "שולם" ? new Date().toISOString() : ps === "שולם פיקדון" ? new Date().toISOString() : null,
                                  } as Record<string, unknown>)}
                                  className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", (order as Record<string, unknown>).payment_status === ps && "bg-muted")}
                                >
                                  {ps === "שולם" ? "שולם ✓" : ps}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    )}
                    {isVisible("workflow") && (
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        {orderWorkflows[order.id] ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer",
                                orderWorkflows[order.id].status === "completed"
                                  ? "bg-success/15 text-success"
                                  : orderWorkflows[order.id].status === "cancelled"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-primary/15 text-primary"
                              )}>
                                {orderWorkflows[order.id].status === "completed" ? (
                                  <><CheckCircle className="h-3 w-3" />הושלם</>
                                ) : orderWorkflows[order.id].status === "cancelled" ? (
                                  <>בוטל</>
                                ) : (
                                  <><Zap className="h-3 w-3" />שלב {orderWorkflows[order.id].current_step + 1}</>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-1" align="start">
                              <div className="flex flex-col gap-0.5">
                                {orderWorkflows[order.id].steps.map((step: { name: string }, idx: number) => {
                                  const wf = orderWorkflows[order.id];
                                  const isCompleted = idx < wf.current_step || wf.status === "completed";
                                  const isCurrent = idx === wf.current_step && wf.status === "active";
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => handleWorkflowStepChange(order.id, wf, idx)}
                                      className={cn(
                                        "px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted flex items-center gap-2",
                                        isCurrent && "bg-primary/10"
                                      )}
                                    >
                                      <span className={cn(
                                        "w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0",
                                        isCompleted ? "bg-success text-success-foreground" :
                                        isCurrent ? "bg-primary text-primary-foreground" :
                                        "bg-muted text-muted-foreground"
                                      )}>
                                        {isCompleted ? "✓" : idx + 1}
                                      </span>
                                      {step.name}
                                    </button>
                                  );
                                })}
                                <button
                                  onClick={() => handleWorkflowStepChange(order.id, orderWorkflows[order.id], orderWorkflows[order.id].steps.length)}
                                  className={cn(
                                    "px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted flex items-center gap-2 border-t mt-1 pt-2",
                                    orderWorkflows[order.id].status === "completed" && "bg-success/10"
                                  )}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                                  סיים תהליך
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    {isVisible("tracking_number") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.tracking_number || "—"}</td>
                    )}
                    {isVisible("tracking_status") && (
                      <td className="p-3 text-xs">
                        {order.tracking_status ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                            order.tracking_status.toLowerCase().includes("delivered") ? "bg-green-100 text-green-700" :
                            order.tracking_status.toLowerCase().includes("transit") || order.tracking_status.toLowerCase().includes("shipment") ? "bg-blue-100 text-blue-700" :
                            order.tracking_status.toLowerCase().includes("exception") || order.tracking_status.toLowerCase().includes("failure") ? "bg-red-100 text-red-700" :
                            "bg-muted text-muted-foreground"
                          )}>
                            <Truck className="h-3 w-3" />
                            {order.tracking_status}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    {isVisible("pi_number") && (
                      <td className="p-3 text-muted-foreground text-xs font-mono">{order.pi_number || "—"}</td>
                    )}
                    {isVisible("updated_at") && (
                      <td className="p-3 text-muted-foreground text-xs">{order.updated_at ? new Date(order.updated_at).toLocaleDateString("he-IL") : "—"}</td>
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
