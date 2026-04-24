import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, CreditCard, Zap, RefreshCw } from "lucide-react";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import type { Priority, OrderStatus } from "@/contexts/AppContext";

const COLUMN_DEFS: ColDef[] = [
  { id: "priority",      label: "עדיפות",  sortField: "priority" },
  { id: "supplier_name", label: "ספק",     sortField: "supplier_name" },
  { id: "pi_number",     label: "PI" },
  { id: "status",        label: "סטטוס",   sortField: "status" },
  { id: "etd",           label: "ETD",     sortField: "etd" },
  { id: "eta",           label: "ETA",     sortField: "eta" },
  { id: "total_price",   label: 'סה"כ',   sortField: "total_price" },
] as const;

type SortField = "priority" | "supplier_name" | "status" | "etd" | "eta" | "total_price";
type SortDir = "asc" | "desc" | null;

const priorityOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };

interface PendingPayment {
  id: string;
  order_id: string | null;
  payment_type: string;
  amount: number;
  currency: string;
  due_date: string | null;
  orders?: { supplier_name: string | null; pi_number: string | null } | null;
}

interface OverdueOrder {
  id: string;
  supplier_name: string | null;
  eta: string | null;
  status: string;
  priority: string;
  pi_number: string | null;
}

interface UrgentOrder {
  id: string;
  priority: string;
  supplier_name: string | null;
  eta: string | null;
  etd: string | null;
  status: string;
  total_price: number | null;
  pi_number: string | null;
}

export function ProcurementAgendaTab() {
  const navigate = useNavigate();
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [overdueOrders, setOverdueOrders] = useState<OverdueOrder[]>([]);
  const [urgentOrders, setUrgentOrders] = useState<UrgentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "procurement-agenda:hidden-columns",
    COLUMN_DEFS,
    []
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const fetchAll = useCallback(async () => {
    setFetching(true);
    setLoading(prev => prev); // keep loading true on first run
    const today = new Date().toISOString();
    const [paymentsRes, overdueRes, urgentRes] = await Promise.all([
      supabase
        .from("order_payments")
        .select("id, order_id, payment_type, amount, currency, due_date, orders(supplier_name, pi_number)")
        .eq("status", "ממתין")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(30),
      supabase
        .from("orders")
        .select("id, supplier_name, eta, status, priority, pi_number")
        .not("eta", "is", null)
        .lt("eta", today)
        .not("status", "in", '("ARRIVED","DELIVERED","CANCELLED")')
        .order("eta", { ascending: true })
        .limit(20),
      supabase
        .from("orders")
        .select("id, priority, supplier_name, eta, etd, status, total_price, pi_number")
        .in("priority", ["דחוף", "גבוה"])
        .in("status", ["PENDING", "ORDERED", "SHIPPED", "ARRIVED_PORT", "CUSTOMS_CLEARANCE"])
        .order("priority", { ascending: true })
        .limit(30),
    ]);
    if (paymentsRes.data) setPendingPayments(paymentsRes.data as PendingPayment[]);
    if (overdueRes.data) setOverdueOrders(overdueRes.data as OverdueOrder[]);
    if (urgentRes.data) setUrgentOrders(urgentRes.data as UrgentOrder[]);
    setLastFetch(new Date());
    setLoading(false);
    setFetching(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Re-fetch when browser tab regains focus
  useEffect(() => {
    const onVisibility = () => { if (!document.hidden) fetchAll(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchAll]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field); setSortDir("asc");
    }
  };

  const sortedUrgent = [...urgentOrders].sort((a, b) => {
    if (!sortField || !sortDir) return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
    let cmp = 0;
    if (sortField === "priority") cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
    else if (sortField === "supplier_name") cmp = (a.supplier_name || "").localeCompare(b.supplier_name || "", "he");
    else if (sortField === "etd") cmp = (a.etd || "").localeCompare(b.etd || "");
    else if (sortField === "eta") cmp = (a.eta || "").localeCompare(b.eta || "");
    else if (sortField === "total_price") cmp = (a.total_price || 0) - (b.total_price || 0);
    return sortDir === "desc" ? -cmp : cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const currencySymbol = (c: string) => c === "USD" ? "$" : c === "EUR" ? "€" : "₪";

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("he-IL") : "—";

  const daysOverdue = (eta: string) => {
    const diff = Math.floor((Date.now() - new Date(eta).getTime()) / 86400000);
    return diff;
  };

  if (loading) return (
    <div className="p-8 text-center text-muted-foreground">טוען...</div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Date + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-xs text-muted-foreground">
              עודכן: {lastFetch.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={fetchAll} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Top two-column cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Pending Payments */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-warning" />
            <h2 className="font-semibold text-foreground">תשלומים ממתינים ({pendingPayments.length})</h2>
          </div>
          {pendingPayments.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">אין תשלומים ממתינים</p>
          ) : (
            <div className="divide-y">
              {pendingPayments.map(p => {
                const dueDate = p.due_date ? new Date(p.due_date) : null;
                const isOverdue = dueDate ? dueDate < new Date() : false;
                const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
                const supplierName = (p.orders as { supplier_name?: string | null } | null)?.supplier_name;
                const piNumber = (p.orders as { pi_number?: string | null } | null)?.pi_number;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "p-3 flex items-start justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors",
                      isOverdue && "border-r-2 border-destructive"
                    )}
                    onClick={() => p.order_id && navigate(`/orders/${p.order_id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{supplierName || "—"}</p>
                      {piNumber && <p className="text-xs text-muted-foreground font-mono">{piNumber}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.payment_type === "Deposit" ? "מקדמה" : p.payment_type === "Balance" ? "יתרה" : "מלא"}
                        {dueDate && <> · {formatDate(p.due_date)}</>}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        {currencySymbol(p.currency)}{(p.amount || 0).toLocaleString()}
                      </p>
                      {daysLeft !== null && (
                        <p className={cn("text-xs", isOverdue ? "text-destructive font-medium" : daysLeft <= 7 ? "text-warning" : "text-muted-foreground")}>
                          {isOverdue ? `${Math.abs(daysLeft)}י׳ עיכוב` : `${daysLeft}י׳ נותרו`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Overdue ETAs */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="font-semibold text-foreground">הזמנות שעברו ETA ({overdueOrders.length})</h2>
          </div>
          {overdueOrders.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">אין הזמנות עם ETA שעבר</p>
          ) : (
            <div className="divide-y">
              {overdueOrders.map(o => (
                <div
                  key={o.id}
                  className="p-3 flex items-start justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors border-r-2 border-destructive"
                  onClick={() => navigate(`/orders/${o.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{o.supplier_name || "—"}</p>
                    {o.pi_number && <p className="text-xs text-muted-foreground font-mono">{o.pi_number}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ETA: {formatDate(o.eta)}
                    </p>
                  </div>
                  <div className="text-left shrink-0 space-y-1">
                    <OrderStatusBadge status={o.status as OrderStatus} />
                    <p className="text-xs text-destructive font-medium">{daysOverdue(o.eta!)}י׳ עיכוב</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Urgent Active Orders */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">הזמנות דחופות פעילות ({sortedUrgent.length})</h2>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y">
          {sortedUrgent.length === 0 ? (
            <p className="p-6 text-sm text-center text-muted-foreground">אין הזמנות דחופות פעילות</p>
          ) : sortedUrgent.map(o => (
            <div
              key={o.id}
              className="p-3 cursor-pointer active:bg-muted/30 transition-colors"
              onClick={() => navigate(`/orders/${o.id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="font-medium text-foreground truncate">{o.supplier_name || "—"}</p>
                <PriorityBadge priority={o.priority as Priority} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={o.status as OrderStatus} />
                {o.pi_number && <span className="text-xs text-muted-foreground font-mono">{o.pi_number}</span>}
                {o.total_price && <span className="text-xs font-medium text-foreground">${o.total_price.toLocaleString()}</span>}
              </div>
              {(o.etd || o.eta) && (
                <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                  {o.etd && <span>ETD: {formatDate(o.etd)}</span>}
                  {o.eta && <span>ETA: {formatDate(o.eta)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
              {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                  {col.sortField ? (
                    <button onClick={() => toggleSort(col.sortField as SortField)} className="flex items-center gap-1 hover:text-primary transition-colors">
                      {col.label} <SortIcon field={col.sortField as SortField} />
                    </button>
                  ) : col.label}
                </th>
              ) : null)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedUrgent.length === 0 ? (
              <tr><td colSpan={visibleCount} className="p-6 text-center text-muted-foreground">אין הזמנות דחופות פעילות</td></tr>
            ) : sortedUrgent.map(o => (
              <tr key={o.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate(`/orders/${o.id}`)}>
                {isVisible("priority") && (
                  <td className="p-3"><PriorityBadge priority={o.priority as Priority} /></td>
                )}
                {isVisible("supplier_name") && (
                  <td className="p-3 font-medium text-foreground">{o.supplier_name || "—"}</td>
                )}
                {isVisible("pi_number") && (
                  <td className="p-3 text-muted-foreground text-xs font-mono">{o.pi_number || "—"}</td>
                )}
                {isVisible("status") && (
                  <td className="p-3"><OrderStatusBadge status={o.status as OrderStatus} /></td>
                )}
                {isVisible("etd") && (
                  <td className="p-3 text-muted-foreground text-xs">{formatDate(o.etd)}</td>
                )}
                {isVisible("eta") && (
                  <td className="p-3 text-muted-foreground text-xs">{formatDate(o.eta)}</td>
                )}
                {isVisible("total_price") && (
                  <td className="p-3 text-muted-foreground text-xs">
                    {o.total_price ? `$${o.total_price.toLocaleString()}` : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => { setSortField(field as SortField); setSortDir("asc"); }}
          onSortDesc={field => { setSortField(field as SortField); setSortDir("desc"); }}
        />
      )}
    </div>
  );
}
