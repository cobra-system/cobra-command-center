import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { type Order, type Supplier, statusLabel } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Globe, MapPin, DollarSign, AlertCircle, Truck, TrendingUp, Clock } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface WorkflowInfo {
  id: string;
  status: string;
  current_step: number;
  steps: { name: string }[];
}

interface OrdersDashboardViewProps {
  orders: Order[];
  orderWorkflows: Record<string, WorkflowInfo>;
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

const PRIORITY_NAMES: Record<string, string> = {
  "דחוף": "דחוף",
  "גבוה": "גבוה",
  "בינוני": "בינוני",
  "נמוך": "נמוך",
};

export function OrdersDashboardView({ orders, orderWorkflows, suppliers }: OrdersDashboardViewProps) {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalValue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const totalQuantity = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);
    const overdue = orders.filter(o => o.eta && new Date(o.eta) < new Date()).length;

    const supplierCountryMap = suppliers.reduce((acc, s) => {
      acc[s.id] = s.country ?? null;
      return acc;
    }, {} as Record<string, string | null>);

    const inProcessOrders = orders.filter(
      o => o.status !== "ARRIVED" && o.status !== "CANCELLED"
    );

    const ordersInProcessIsrael = inProcessOrders.filter(o => {
      const country = o.supplier_id ? supplierCountryMap[o.supplier_id] : null;
      return country === "ישראל";
    }).length;

    const ordersInProcessAbroad = inProcessOrders.filter(o => {
      const country = o.supplier_id ? supplierCountryMap[o.supplier_id] : null;
      return country !== "ישראל";
    }).length;

    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityCounts = orders.reduce((acc, o) => {
      acc[o.priority] = (acc[o.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const paymentStatus = orders.reduce((acc, o) => {
      const status = (o as Record<string, unknown>).payment_status || "ממתין";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      totalValue,
      totalQuantity,
      overdue,
      statusCounts,
      priorityCounts,
      paymentStatus,
      ordersInProcessIsrael,
      ordersInProcessAbroad,
    };
  }, [orders, suppliers]);

  const statusChartData = useMemo(() => {
    return Object.entries(stats.statusCounts)
      .filter(([status]) => status !== "ARRIVED" && status !== "CANCELLED")
      .map(([status, count]) => ({
        name: statusLabel[status] || status,
        value: count,
        fill: STATUS_COLORS[status] || "#808080",
      }));
  }, [stats]);

  const priorityChartData = useMemo(() => {
    return Object.entries(stats.priorityCounts)
      .map(([priority, count]) => ({
        name: PRIORITY_NAMES[priority] || priority,
        value: count,
        fill: PRIORITY_COLORS[priority] || "#gray",
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const paymentChartData = useMemo(() => {
    return Object.entries(stats.paymentStatus).map(([status, count]) => ({
      name: status,
      value: count,
    }));
  }, [stats]);

  // Timeline - orders sorted by ETA
  const timelineOrders = useMemo(() => {
    return [...orders]
      .filter(o => o.eta)
      .sort((a, b) => (a.eta || "").localeCompare(b.eta || ""))
      .slice(0, 8);
  }, [orders]);

  // Get upcoming orders (next 7 days)
  const upcomingOrders = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return orders.filter(o => {
      if (!o.eta) return false;
      const eta = new Date(o.eta);
      return eta >= now && eta <= sevenDaysFromNow;
    });
  }, [orders]);

  const StatCard = ({ icon: Icon, label, value, bgColor }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; bgColor: string }) => (
    <div className={cn("rounded-lg p-4 border", bgColor)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          icon={MapPin}
          label="הזמנות בתהליך מישראל"
          value={stats.ordersInProcessIsrael}
          bgColor="bg-blue-50 border-blue-200"
        />
        <StatCard
          icon={Globe}
          label="הזמנות בתהליך מחול"
          value={stats.ordersInProcessAbroad}
          bgColor="bg-purple-50 border-purple-200"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution */}
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-4">התפלגות סטטוס</h3>
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

        {/* Priority Distribution */}
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-4">התפלגות עדיפות</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} reversed />
              <YAxis tick={{ fontSize: 12 }} orientation="right" />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Status */}
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-4">סטטוס תשלום</h3>
          <div className="space-y-3">
            {paymentChartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden" dir="ltr">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(item.value / stats.totalOrders) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Orders Timeline */}
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
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-orange-500"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {order.items.map(i => i.name).join(", ") || "ללא פריטים"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.supplier_name} • {new Date(order.eta!).toLocaleDateString("he-IL")}
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

      {/* Timeline View */}
      <div className="bg-card rounded-xl border p-4">
        <h3 className="text-sm font-semibold mb-4">ציר הזמן - הזמנות לפי ETA</h3>
        <div className="space-y-3">
          {timelineOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">אין הזמנות עם תאריך הגעה</p>
          ) : (
            timelineOrders.map((order) => {
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
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-r-4 hover:shadow-md transition-all"
                    style={{
                      borderRightColor: PRIORITY_COLORS[order.priority] || "#gray",
                      backgroundColor: isOverdue ? "#fef2f2" : isPriority ? "#fef3c7" : "transparent",
                    }}
                  >
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs",
                        isOverdue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {daysUntil !== null ? (daysUntil < 0 ? `${Math.abs(daysUntil)}` : daysUntil) : "?"}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {daysUntil !== null ? (daysUntil < 0 ? "ימים\nעברו" : "ימים") : ""}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {order.items.map(i => i.name).join(", ") || "ללא פריטים"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.supplier_name || "—"} • {new Date(order.eta!).toLocaleDateString("he-IL")}
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
            })
          )}
        </div>
      </div>
    </div>
  );
}
