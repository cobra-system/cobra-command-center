import { useNavigate } from "react-router-dom";
import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Order, type Supplier } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Globe, MapPin, DollarSign, AlertCircle, Truck, Clock, ChevronDown, ChevronUp, CreditCard, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { supabase } from "@/lib/supabase";
import { useData, useCurrency } from "@/contexts/AppContext";
import { toast } from "sonner";

import { format } from "date-fns";
interface OrderPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: "USD" | "EUR" | "ILS";
  due_date: string | null;
  status: "ממתין" | "שולם";
  payment_type: "Deposit" | "Balance" | "Full";
  supplier_name?: string;
  order_items?: string;
}

interface OrdersDashboardViewProps {
  orders: Order[];
  orderPaymentStatuses: Record<string, string>;
  suppliers: Supplier[];
}

const STATUS_COLORS: Record<string, string> = {
  "PENDING": "#fbbf24",
  "ORDERED": "#60a5fa",
  "SHIPPED": "#8b5cf6",
  "ARRIVED_PORT": "#a78bfa",
  "CUSTOMS_CLEARANCE": "#f472b6",
  "DELIVERED": "#34d399",
  "ARRIVED": "#10b981",
  "CANCELLED": "#ef4444",
};

const PRIORITY_COLORS: Record<string, string> = {
  "דחוף": "#ef4444",
  "גבוה": "#f97316",
  "בינוני": "#3b82f6",
  "נמוך": "#9ca3af",
};

const ACTIVE_STATUSES = ["PENDING", "ORDERED", "SHIPPED", "ARRIVED_PORT", "CUSTOMS_CLEARANCE", "DELIVERED"];

export function OrdersDashboardView({ orders, orderPaymentStatuses, suppliers }: OrdersDashboardViewProps) {
  const { formatPrice, formatPriceCompact } = useCurrency();
  const navigate = useNavigate();
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [paymentSupplierFilter, setPaymentSupplierFilter] = useState<string>("all");
  const [bulkTracking, setBulkTracking] = useState<{ running: boolean; done: number; total: number }>({ running: false, done: 0, total: 0 });
  const abortRef = useRef(false);
  const { refreshOrders } = useData();

  const { data: allPayments = [] } = useQuery({
    queryKey: ["order-payments-dashboard"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_payments")
        .select("id, order_id, amount, currency, due_date, status, payment_type, orders(supplier_name, order_items(name))")
        .order("due_date", { ascending: true });
      if (!data) return [] as OrderPayment[];
      return data.map((p: Record<string, unknown>) => {
        const ord = p.orders as Record<string, unknown> | null;
        const items = (ord?.order_items as { name: string }[] | null) ?? [];
        return {
          id: p.id as string,
          order_id: p.order_id as string,
          amount: p.amount as number,
          currency: p.currency as OrderPayment["currency"],
          due_date: p.due_date as string | null,
          status: p.status as OrderPayment["status"],
          payment_type: p.payment_type as OrderPayment["payment_type"],
          supplier_name: (ord?.supplier_name as string) ?? undefined,
          order_items: items.map(i => i.name).join(", ") || undefined,
        } satisfies OrderPayment;
      });
    },
  });

  const upcomingPayments = useMemo(() => {
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    return allPayments.filter(p => p.status === "ממתין" && p.due_date && new Date(p.due_date) <= thirtyDays);
  }, [allPayments]);

  const handleBulkRefreshTracking = async () => {
    const trackableOrders = activeOrders.filter(o => o.tracking_number && o.tracking_carrier === "dhl");
    if (trackableOrders.length === 0) { toast.error("אין הזמנות פעילות עם ספק מעקב DHL מוגדר"); return; }
    abortRef.current = false;
    setBulkTracking({ running: true, done: 0, total: trackableOrders.length });
    const { data: { session } } = await supabase.auth.getSession();
    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const CHUNK_SIZE = 25;
    let updated = 0;
    let done = 0;
    for (let i = 0; i < trackableOrders.length; i += CHUNK_SIZE) {
      if (abortRef.current) break;
      const chunk = trackableOrders.slice(i, i + CHUNK_SIZE);
      try {
        const res = await fetch(`${baseUrl}/functions/v1/track-shipments-bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
          body: JSON.stringify({ order_ids: chunk.map(o => o.id) }),
        });
        const json = await res.json().catch(() => null);
        if (json && typeof json.updated === "number") updated += json.updated;
      } catch { /* continue on chunk failure */ }
      done += chunk.length;
      setBulkTracking(prev => ({ ...prev, done }));
    }
    setBulkTracking({ running: false, done, total: trackableOrders.length });
    toast.success(`עודכן מעקב ל-${updated} הזמנות`);
    await refreshOrders();
  };

  const activeOrders = useMemo(
    () => orders.filter(o => ACTIVE_STATUSES.includes(o.status)),
    [orders]
  );

  const stats = useMemo(() => {
    const totalValue = activeOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const overdue = activeOrders.filter(o => o.eta && new Date(o.eta) < new Date()).length;

    const supplierCountryMap = suppliers.reduce((acc, s) => {
      acc[s.id] = s.country ?? null;
      return acc;
    }, {} as Record<string, string | null>);

    const ordersInProcessIsrael = activeOrders.filter(o => {
      const country = o.supplier_id ? supplierCountryMap[o.supplier_id] : null;
      return country === "ישראל";
    }).length;

    const ordersInProcessAbroad = activeOrders.filter(o => {
      const country = o.supplier_id ? supplierCountryMap[o.supplier_id] : null;
      return country !== "ישראל";
    }).length;

    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityCounts = activeOrders.reduce((acc, o) => {
      acc[o.priority] = (acc[o.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalValue,
      overdue,
      statusCounts,
      priorityCounts,
      ordersInProcessIsrael,
      ordersInProcessAbroad,
    };
  }, [orders, activeOrders, suppliers]);

  const statusChartData = useMemo(() => {
    return Object.entries(stats.statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      fill: STATUS_COLORS[status] || "#808080",
    }));
  }, [stats]);

  const priorityChartData = useMemo(() => {
    return Object.entries(stats.priorityCounts)
      .map(([priority, count]) => ({
        name: priority,
        value: count,
        fill: PRIORITY_COLORS[priority] || "#9ca3af",
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const paymentSupplierOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; name: string }[] = [];
    for (const o of activeOrders) {
      if (o.supplier_id && o.supplier_name && !seen.has(o.supplier_id)) {
        seen.add(o.supplier_id);
        opts.push({ id: o.supplier_id, name: o.supplier_name });
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [activeOrders]);

  const paymentChartData = useMemo(() => {
    const filtered = paymentSupplierFilter === "all"
      ? activeOrders
      : activeOrders.filter(o => o.supplier_id === paymentSupplierFilter);

    const total = filtered.length || 1;
    const counts = filtered.reduce((acc, o) => {
      const status = orderPaymentStatuses[o.id] || "ממתין";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { counts, total };
  }, [activeOrders, paymentSupplierFilter, orderPaymentStatuses]);

  const timelineOrders = useMemo(() => {
    return [...activeOrders]
      .filter(o => o.eta)
      .sort((a, b) => (a.eta || "").localeCompare(b.eta || ""));
  }, [activeOrders]);

  const visibleTimelineOrders = timelineExpanded ? timelineOrders : timelineOrders.slice(0, 8);

  const cashFlowData = useMemo(() => {
    const months: { key: string; label: string; paid: number; pending: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = format(d, "MM/yyyy");
      months.push({ key, label, paid: 0, pending: 0 });
    }
    for (const p of allPayments) {
      if (!p.due_date) continue;
      const monthKey = p.due_date.slice(0, 7);
      const bucket = months.find(m => m.key === monthKey);
      if (!bucket) continue;
      const usd = p.currency === "USD" ? p.amount : p.currency === "EUR" ? p.amount * 1.08 : p.amount / 3.7;
      if (p.status === "שולם") bucket.paid += usd;
      else bucket.pending += usd;
    }
    return months.map(m => ({ ...m, paid: Math.round(m.paid), pending: Math.round(m.pending) }));
  }, [allPayments]);

  const supplierPerformance = useMemo(() => {
    type SupplierStat = {
      id: string;
      name: string;
      active: number;
      arrived: number;
      onTime: number;
      totalDelayDays: number;
    };
    const map = new Map<string, SupplierStat>();

    for (const o of orders) {
      if (!o.supplier_id || !o.supplier_name) continue;
      if (!map.has(o.supplier_id)) {
        map.set(o.supplier_id, { id: o.supplier_id, name: o.supplier_name, active: 0, arrived: 0, onTime: 0, totalDelayDays: 0 });
      }
      const s = map.get(o.supplier_id)!;
      if (ACTIVE_STATUSES.includes(o.status)) s.active++;
      if (o.status === "ARRIVED" && o.eta && o.updated_at) {
        const etaDate = new Date(o.eta);
        const arrivedDate = new Date(o.updated_at);
        const delayDays = Math.round((arrivedDate.getTime() - etaDate.getTime()) / (1000 * 60 * 60 * 24));
        s.arrived++;
        s.totalDelayDays += delayDays;
        if (delayDays <= 0) s.onTime++;
      }
    }

    return [...map.values()]
      .filter(s => s.active > 0 || s.arrived > 0)
      .sort((a, b) => (b.active + b.arrived) - (a.active + a.arrived))
      .slice(0, 10)
      .map(s => ({
        ...s,
        onTimePct: s.arrived > 0 ? Math.round((s.onTime / s.arrived) * 100) : null,
        avgDelay: s.arrived > 0 ? Math.round(s.totalDelayDays / s.arrived) : null,
      }));
  }, [orders]);

  const upcomingGrouped = useMemo(() => {
    const now = new Date();
    const endOfWeek = new Date(now); endOfWeek.setDate(now.getDate() + 7);
    const endOfNextWeek = new Date(now); endOfNextWeek.setDate(now.getDate() + 14);
    const thisWeek: OrderPayment[] = [];
    const nextWeek: OrderPayment[] = [];
    const later: OrderPayment[] = [];
    for (const p of upcomingPayments) {
      const d = new Date(p.due_date!);
      if (d <= endOfWeek) thisWeek.push(p);
      else if (d <= endOfNextWeek) nextWeek.push(p);
      else later.push(p);
    }
    return { thisWeek, nextWeek, later };
  }, [upcomingPayments]);

  const upcomingOrders = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return activeOrders.filter(o => {
      if (!o.eta) return false;
      const eta = new Date(o.eta);
      return eta >= now && eta <= sevenDaysFromNow;
    });
  }, [activeOrders]);

  const StatCard = ({
    icon: Icon,
    label,
    value,
    bgColor,
    valueColor,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    bgColor: string;
    valueColor?: string;
  }) => (
    <div className={cn("rounded-lg p-4 border", bgColor)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className={cn("text-2xl font-bold", valueColor)}>{value}</p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
    </div>
  );

  const trackableCount = activeOrders.filter(o => o.tracking_number && o.tracking_carrier === "dhl").length;

  return (
    <div className="space-y-6">
      {/* Bulk DHL Refresh */}
      {trackableCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{trackableCount} הזמנות עם מספר מעקב DHL</span>
          <button
            onClick={handleBulkRefreshTracking}
            disabled={bulkTracking.running}
            className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${bulkTracking.running ? "animate-spin" : ""}`} />
            {bulkTracking.running
              ? `מעדכן... ${bulkTracking.done}/${bulkTracking.total}`
              : "רענן מעקב DHL"}
          </button>
        </div>
      )}

      {/* Summary Stats — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MapPin}
          label="בתהליך מישראל"
          value={stats.ordersInProcessIsrael}
          bgColor="bg-blue-50 border-blue-200"
        />
        <StatCard
          icon={Globe}
          label="בתהליך מחו״ל"
          value={stats.ordersInProcessAbroad}
          bgColor="bg-purple-50 border-purple-200"
        />
        <StatCard
          icon={AlertCircle}
          label="הזמנות באיחור"
          value={stats.overdue}
          bgColor={stats.overdue > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}
          valueColor={stats.overdue > 0 ? "text-red-600" : undefined}
        />
        <StatCard
          icon={DollarSign}
          label="ערך צנרת פתוחה"
          value={formatPrice(stats.totalValue)}
          bgColor="bg-emerald-50 border-emerald-200"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution */}
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-4">התפלגות סטטוס (כל ההזמנות)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${value}`}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Distribution — active orders only */}
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-1">התפלגות עדיפות</h3>
          <p className="text-xs text-muted-foreground mb-3">הזמנות פעילות בלבד</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} reversed />
              <YAxis tick={{ fontSize: 12 }} orientation="right" />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {priorityChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Status — with supplier filter */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">סטטוס תשלום</h3>
            <select
              value={paymentSupplierFilter}
              onChange={e => setPaymentSupplierFilter(e.target.value)}
              className="text-xs border rounded px-2 py-1 bg-background text-foreground max-w-[130px] truncate"
            >
              <option value="all">כל הספקים</option>
              {paymentSupplierOptions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {Object.entries(paymentChartData.counts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden" dir="ltr">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(count / paymentChartData.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(paymentChartData.counts).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">אין נתונים</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Orders (next 7 days) */}
      {upcomingOrders.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-orange-500" />
            <h3 className="text-sm font-semibold">משלוחים מתקרבים (7 ימים)</h3>
          </div>
          <div className="space-y-2">
            {upcomingOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-orange-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {order.items.map(i => i.name).join(", ") || "ללא פריטים"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.supplier_name} • {format(new Date(order.eta!), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{order.items.reduce((s, i) => s + i.qty, 0)}</span>
                  <span className="text-muted-foreground">יח׳</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline — active orders only */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">ציר הזמן — הזמנות לפי ETA</h3>
          {timelineOrders.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {timelineExpanded ? timelineOrders.length : Math.min(8, timelineOrders.length)} מתוך {timelineOrders.length}
            </span>
          )}
        </div>
        <div className="space-y-3">
          {timelineOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">אין הזמנות פעילות עם תאריך הגעה</p>
          ) : (
            <>
              {visibleTimelineOrders.map((order) => {
                const daysUntil = order.eta
                  ? Math.ceil(
                      (new Date(order.eta).getTime() - new Date().getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : null;
                const isOverdue = daysUntil !== null && daysUntil < 0;
                const isPriority = order.priority === "דחוף" || order.priority === "גבוה";

                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="cursor-pointer group"
                  >
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg border border-r-4 hover:shadow-md transition-all"
                      style={{
                        borderRightColor: PRIORITY_COLORS[order.priority] || "#9ca3af",
                        backgroundColor: isOverdue ? "#fef2f2" : isPriority ? "#fef3c7" : "transparent",
                      }}
                    >
                      <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs",
                          isOverdue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {daysUntil !== null ? Math.abs(daysUntil) : "?"}
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight text-center">
                          {daysUntil !== null ? (daysUntil < 0 ? "עברו" : "ימים") : ""}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {order.items.map(i => i.name).join(", ") || "ללא פריטים"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {order.supplier_name || "—"} • {format(new Date(order.eta!), "dd/MM/yyyy")}
                        </p>
                      </div>

                      <div className="flex-shrink-0 flex items-center gap-4">
                        <div className="flex items-center gap-1 text-xs">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          <span className="font-semibold">{order.items.reduce((s, i) => s + i.qty, 0)}</span>
                        </div>
                        {order.total_price && (
                          <div className="flex items-center gap-1 text-xs">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold">${order.total_price.toLocaleString()}</span>
                          </div>
                        )}
                        {isOverdue && (
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {timelineOrders.length > 8 && (
                <button
                  onClick={() => setTimelineExpanded(v => !v)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-lg hover:bg-muted/30"
                >
                  {timelineExpanded ? (
                    <><ChevronUp className="h-3 w-3" /> הצג פחות</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" /> הצג עוד {timelineOrders.length - 8} הזמנות</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {/* Upcoming Payments */}
      {upcomingPayments.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-semibold">תשלומים קרובים (30 יום)</h3>
            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{upcomingPayments.length}</span>
          </div>
          {(["thisWeek", "nextWeek", "later"] as const).map(group => {
            const groupLabels = { thisWeek: "השבוע", nextWeek: "שבוע הבא", later: "מאוחר יותר" };
            const items = upcomingGrouped[group];
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{groupLabels[group]}</p>
                <div className="space-y-2">
                  {items.map(p => {
                    const daysLeft = p.due_date
                      ? Math.ceil((new Date(p.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      : null;
                    const isUrgent = daysLeft !== null && daysLeft <= 3;
                    return (
                      <div
                        key={p.id}
                        onClick={() => navigate(`/orders/${p.order_id}`)}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.supplier_name || "—"}</p>
                          {p.order_items && <p className="text-xs text-muted-foreground truncate">{p.order_items}</p>}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={cn(
                            "text-xs rounded-full px-2 py-0.5",
                            isUrgent ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
                          )}>
                            {daysLeft !== null ? (daysLeft === 0 ? "היום" : `${daysLeft} ימים`) : "—"}
                          </span>
                          <span className="text-sm font-semibold">
                            {formatPrice(p.amount, p.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supplier Performance */}
      {supplierPerformance.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-1">ביצועי ספקים</h3>
          <p className="text-xs text-muted-foreground mb-4">זמן הגעה מחושב לפי ETA מול תאריך עדכון סטטוס ל-ARRIVED</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right">
                  <th className="pb-2 font-semibold text-muted-foreground">ספק</th>
                  <th className="pb-2 font-semibold text-muted-foreground text-center">פעילות</th>
                  <th className="pb-2 font-semibold text-muted-foreground text-center">הגיעו</th>
                  <th className="pb-2 font-semibold text-muted-foreground text-center">% בזמן</th>
                  <th className="pb-2 font-semibold text-muted-foreground text-center">איחור ממוצע</th>
                </tr>
              </thead>
              <tbody>
                {supplierPerformance.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/suppliers/${s.id}`)}>
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2 text-center">{s.active}</td>
                    <td className="py-2 text-center">{s.arrived}</td>
                    <td className="py-2 text-center">
                      {s.onTimePct !== null ? (
                        <span className={cn("font-semibold", s.onTimePct >= 80 ? "text-green-600" : s.onTimePct >= 50 ? "text-yellow-600" : "text-red-600")}>
                          {s.onTimePct}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-2 text-center">
                      {s.avgDelay !== null ? (
                        <span className={cn("font-semibold", s.avgDelay <= 0 ? "text-green-600" : s.avgDelay <= 7 ? "text-yellow-600" : "text-red-600")}>
                          {s.avgDelay > 0 ? `+${s.avgDelay}` : s.avgDelay} ימים
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Flow Chart */}
      {cashFlowData.some(m => m.paid > 0 || m.pending > 0) && (
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-1">תזרים תשלומים לפי חודש</h3>
          <p className="text-xs text-muted-foreground mb-4">הערכה ב-USD (EUR × 1.08, ILS ÷ 3.7)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cashFlowData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} reversed />
              <YAxis tick={{ fontSize: 11 }} orientation="right" tickFormatter={v => formatPriceCompact(v)} />
              <Tooltip formatter={(value: number) => formatPrice(value)} />
              <Legend />
              <Bar dataKey="paid" name="שולם" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" name="ממתין" fill="#fb923c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
