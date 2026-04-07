import { useNavigate } from "react-router-dom";
import { type Order, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Trash2, Copy, ArrowUpDown, ArrowUp, ArrowDown, Zap, CheckCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Priority } from "@/contexts/AppContext";

export type SortField = "priority" | "product" | "qty" | "supplier" | "shipping" | "status" | "order_date" | "etd" | "eta" | "total_price" | "payment" | "workflow" | "tracking_number" | "updated_at";
export type SortDir = "asc" | "desc" | null;

export interface WorkflowInfo {
  id: string;
  status: string;
  current_step: number;
  steps: { name: string }[];
}

interface OrderTableProps {
  filtered: Order[];
  orderWorkflows: Record<string, WorkflowInfo>;
  hasEdit: boolean;
  sortField: SortField | null;
  sortDir: SortDir;
  toggleSort: (field: SortField) => void;
  allStatuses: { value: OrderStatus; label: string }[];
  navigateToSupplier: (supplierName: string, e: React.MouseEvent) => void;
  navigateToProduct: (productId: string, e: React.MouseEvent) => void;
  handleDeleteOrder: (orderId: string, e: React.MouseEvent) => void;
  handleDuplicateOrder: (orderId: string, e: React.MouseEvent) => void;
  handleWorkflowStepChange: (orderId: string, wf: WorkflowInfo, newStep: number) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
}

const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
};

const ThButton = ({
  field,
  children,
  toggleSort,
  sortField,
  sortDir,
  className,
}: {
  field: SortField;
  children: React.ReactNode;
  toggleSort: (field: SortField) => void;
  sortField: SortField | null;
  sortDir: SortDir;
  className?: string;
}) => (
  <th className={cn("text-right p-3 font-semibold text-foreground", className)}>
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-primary transition-colors">
      {children}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  </th>
);

export function OrderTable({
  filtered,
  orderWorkflows,
  hasEdit,
  sortField,
  sortDir,
  toggleSort,
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

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-x-auto" dir="rtl">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b bg-muted/50">
            <ThButton field="priority" toggleSort={toggleSort} sortField={sortField} sortDir={sortDir}>עדיפות</ThButton>
            <ThButton field="product" toggleSort={toggleSort} sortField={sortField} sortDir={sortDir}>מוצר</ThButton>
            <ThButton field="qty" toggleSort={toggleSort} sortField={sortField} sortDir={sortDir}>כמות</ThButton>
            <ThButton field="supplier" toggleSort={toggleSort} sortField={sortField} sortDir={sortDir}>ספק</ThButton>
            <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden md:table-cell">
              <button onClick={() => toggleSort("shipping")} className="flex items-center gap-1 hover:text-primary transition-colors">
                משלוח<SortIcon field="shipping" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <ThButton field="status" toggleSort={toggleSort} sortField={sortField} sortDir={sortDir}>סטטוס</ThButton>
            <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden md:table-cell">
              <button onClick={() => toggleSort("order_date")} className="flex items-center gap-1 hover:text-primary transition-colors">
                תאריך הזמנה<SortIcon field="order_date" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
              <button onClick={() => toggleSort("etd")} className="flex items-center gap-1 hover:text-primary transition-colors">
                ETD<SortIcon field="etd" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <ThButton field="eta" toggleSort={toggleSort} sortField={sortField} sortDir={sortDir}>ETA</ThButton>
            <ThButton field="total_price" toggleSort={toggleSort} sortField={sortField} sortDir={sortDir}>סה״כ</ThButton>
            <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
              <button onClick={() => toggleSort("payment")} className="flex items-center gap-1 hover:text-primary transition-colors">
                תשלום<SortIcon field="payment" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
              <button onClick={() => toggleSort("workflow")} className="flex items-center gap-1 hover:text-primary transition-colors">
                תהליך<SortIcon field="workflow" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
              <button onClick={() => toggleSort("tracking_number")} className="flex items-center gap-1 hover:text-primary transition-colors">
                מספר מעקב<SortIcon field="tracking_number" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <th className="text-right p-2 sm:p-3 font-semibold text-foreground hidden lg:table-cell">
              <button onClick={() => toggleSort("updated_at")} className="flex items-center gap-1 hover:text-primary transition-colors">
                עודכן לאחרונה<SortIcon field="updated_at" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <th className="text-right p-2 sm:p-3 font-semibold text-foreground w-10"></th>
            {hasEdit && <th className="text-right p-2 sm:p-3 font-semibold text-foreground w-10"></th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 ? (
            <tr><td colSpan={hasEdit ? 16 : 15} className="p-8 text-center text-muted-foreground">אין הזמנות</td></tr>
          ) : filtered.map((order) => (
            <tr key={order.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={(e) => { if (e.detail !== 1) return; navigate(`/orders/${order.id}`); }} data-navigate-to={`/orders/${order.id}`}>
              <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
              <td className="p-3 font-medium text-foreground max-w-[200px] truncate" onClick={e => e.stopPropagation()}>
                {order.items.length === 0 ? (
                  <span className="text-muted-foreground italic text-xs">ללא פריטים</span>
                ) : order.items.map((i, idx) => (
                  <span key={idx}>
                    {i.product_id ? (
                      <button onClick={(e) => navigateToProduct(i.product_id!, e)} className="text-primary hover:underline text-sm">
                        {i.name}
                      </button>
                    ) : (
                      <span>{i.name}</span>
                    )}
                    {idx < order.items.length - 1 && <span>, </span>}
                  </span>
                ))}
              </td>
              <td className="p-3 text-muted-foreground">{order.items.reduce((s, i) => s + i.qty, 0) || "—"}</td>
              <td className="p-3">
                {order.supplier_name ? (
                  <button onClick={(e) => navigateToSupplier(order.supplier_name!, e)} className="text-primary hover:underline text-sm">
                    {order.supplier_name}
                  </button>
                ) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="p-2 sm:p-3 text-muted-foreground hidden md:table-cell">{order.shipping || "—"}</td>
              <td className="p-2 sm:p-3" onClick={e => e.stopPropagation()}>
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
              <td className="p-2 sm:p-3 text-muted-foreground text-xs hidden md:table-cell">{order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"}</td>
              <td className="p-2 sm:p-3 text-muted-foreground text-xs hidden lg:table-cell">{order.etd ? new Date(order.etd).toLocaleDateString("he-IL") : "—"}</td>
              <td className="p-2 sm:p-3 text-muted-foreground text-xs">{order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}</td>
              <td className="p-2 sm:p-3 text-muted-foreground text-xs">{order.total_price ? `$${order.total_price.toLocaleString()}` : "—"}</td>
              <td className="p-2 sm:p-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
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
                        return <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", colors[ps] || "bg-muted text-muted-foreground")}>{ps}</span>;
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
              <td className="p-2 sm:p-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
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
              <td className="p-2 sm:p-3 text-muted-foreground text-xs hidden lg:table-cell">{order.tracking_number || "—"}</td>
              <td className="p-2 sm:p-3 text-muted-foreground text-xs hidden lg:table-cell">{order.updated_at ? new Date(order.updated_at).toLocaleDateString("he-IL") : "—"}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
