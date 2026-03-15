import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useData, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Package, Truck, ClipboardList, Users, AlertTriangle, ScrollText, Wrench, ChevronLeft, Zap, TrendingUp, DollarSign } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const priorityOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };

const SEVERITY_COLORS: Record<string, string> = {
  "נמוך": "hsl(var(--muted-foreground))",
  "בינוני": "hsl(var(--warning))",
  "גבוה": "hsl(var(--accent))",
  "קריטי": "hsl(var(--destructive))",
};

export default function DashboardPage() {
  const { products, orders, tasks, suppliers } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeWorkflows, setActiveWorkflows] = useState(0);
  const [expiringLicenses, setExpiringLicenses] = useState<{ id: string; name: string; daysLeft: number }[]>([]);
  const [openIssueCount, setOpenIssueCount] = useState(0);
  const [severityData, setSeverityData] = useState<{ name: string; value: number }[]>([]);
  const [pendingPayments, setPendingPayments] = useState(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const [workflowRes, licensesRes, issuesRes, paymentsRes] = await Promise.all([
        supabase.from("workflow_instances").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("compliance_items").select("id, name, expiry_date").not("expiry_date", "is", null).order("expiry_date", { ascending: true }).limit(10),
        supabase.from("product_issues").select("severity, status"),
        supabase.from("supplier_payments").select("amount, status").neq("status", "שולם"),
      ]);

      setActiveWorkflows(workflowRes.count || 0);

      if (licensesRes.data) {
        const now = Date.now();
        setExpiringLicenses(
          licensesRes.data
            .map(d => ({ id: d.id, name: d.name, daysLeft: Math.ceil((new Date(d.expiry_date!).getTime() - now) / 86400000) }))
            .filter(d => d.daysLeft <= 90 && d.daysLeft > 0)
            .slice(0, 3)
        );
      }

      if (issuesRes.data) {
        const open = issuesRes.data.filter((d: any) => d.status !== "נסגר");
        setOpenIssueCount(open.length);
        const sevMap: Record<string, number> = {};
        open.forEach((d: any) => { sevMap[d.severity] = (sevMap[d.severity] || 0) + 1; });
        setSeverityData(Object.entries(sevMap).map(([name, value]) => ({ name, value })));
      }

      if (paymentsRes.data) {
        setPendingPayments(paymentsRes.data.reduce((s: number, p: any) => s + (p.amount || 0), 0));
      }
    };
    fetchDashboardData();
  }, []);

  const openOrdersCount = orders.filter(o => o.status !== "ARRIVED" && o.status !== "CANCELLED").length;
  const shippedCount = orders.filter(o => o.status === "SHIPPED").length;
  const openTasksCount = tasks.filter(t => t.status !== "DONE").length;
  const lowStockCount = products.filter(p => p.reorder_point && p.stock_qty <= p.reorder_point).length;

  const topOrders = useMemo(() =>
    orders
      .filter(o => o.status !== "ARRIVED" && o.status !== "CANCELLED")
      .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
      .slice(0, 5),
    [orders]
  );

  const topTasks = useMemo(() =>
    tasks
      .filter(t => t.status !== "DONE")
      .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
      .slice(0, 5),
    [tasks]
  );

  // Product stock chart — top 10 products by stock
  const productStockData = useMemo(() => {
    return products
      .filter(p => p.stock_qty > 0)
      .sort((a, b) => b.stock_qty - a.stock_qty)
      .slice(0, 10)
      .map(p => ({ name: p.name, value: p.stock_qty }));
  }, [products]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">שלום, {currentUser?.name || "מנהל"} 👋</h1>
          <p className="text-sm text-muted-foreground">סיכום מצב תפעולי</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "מוצרים", value: products.length, icon: Package, color: "text-primary", path: "/products" },
          { label: "הזמנות פתוחות", value: openOrdersCount, icon: Truck, color: "text-accent", path: "/orders" },
          { label: "בדרך", value: shippedCount, icon: TrendingUp, color: "text-success", path: "/orders" },
          { label: "משימות פתוחות", value: openTasksCount, icon: ClipboardList, color: "text-warning", path: "/tasks" },
          { label: "ספקים", value: suppliers.length, icon: Users, color: "text-primary", path: "/suppliers" },
          { label: "תקלות פתוחות", value: openIssueCount, icon: Wrench, color: "text-destructive", path: "/issues" },
        ].map(k => (
          <div
            key={k.label}
            onClick={() => navigate(k.path)}
            className="bg-card rounded-xl border p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={cn("h-4 w-4", k.color)} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alert Banners - compact row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {activeWorkflows > 0 && (
          <div onClick={() => navigate("/workflows")} className="bg-primary/5 border border-primary/20 rounded-lg p-3 cursor-pointer hover:bg-primary/10 transition-colors flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{activeWorkflows} תהליכים פעילים</p>
              <p className="text-xs text-muted-foreground truncate">דורשים טיפול</p>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {lowStockCount > 0 && (
          <div onClick={() => navigate("/inventory")} className="bg-warning/5 border border-warning/20 rounded-lg p-3 cursor-pointer hover:bg-warning/10 transition-colors flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{lowStockCount} מוצרים במלאי נמוך</p>
              <p className="text-xs text-muted-foreground truncate">מתחת לנקודת הזמנה</p>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {expiringLicenses.length > 0 && (
          <div onClick={() => navigate("/compliance")} className="bg-warning/5 border border-warning/20 rounded-lg p-3 cursor-pointer hover:bg-warning/10 transition-colors flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-warning flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{expiringLicenses.length} רישיונות פגים בקרוב</p>
              <p className="text-xs text-muted-foreground truncate">{expiringLicenses.map(l => `${l.name} (${l.daysLeft}י')`).join(", ")}</p>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {pendingPayments > 0 && (
          <div onClick={() => navigate("/documents")} className="bg-accent/5 border border-accent/20 rounded-lg p-3 cursor-pointer hover:bg-accent/10 transition-colors flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">${pendingPayments.toLocaleString()} ממתין לתשלום</p>
              <p className="text-xs text-muted-foreground truncate">תשלומים פתוחים</p>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Main content: Orders + Tasks side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Open Orders */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="flex items-center justify-between p-4 pb-2">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-accent" />הזמנות פתוחות
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/orders")} className="text-xs text-muted-foreground">
              הכל ({openOrdersCount})<ChevronLeft className="h-3 w-3 mr-1" />
            </Button>
          </div>
          <div className="px-4 pb-4">
            {topOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">אין הזמנות פתוחות 🎉</p>
            ) : (
              <div className="space-y-1">
                {topOrders.map(o => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <PriorityBadge priority={o.priority as Priority} />
                      <span className="text-sm text-foreground truncate">{o.items.map(i => i.name).join(", ")}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:inline">{o.supplier_name}</span>
                      <OrderStatusBadge status={o.status as OrderStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Open Tasks */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="flex items-center justify-between p-4 pb-2">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-warning" />משימות פתוחות
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")} className="text-xs text-muted-foreground">
              הכל ({openTasksCount})<ChevronLeft className="h-3 w-3 mr-1" />
            </Button>
          </div>
          <div className="px-4 pb-4">
            {topTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">אין משימות פתוחות 🎉</p>
            ) : (
              <div className="space-y-1">
                {topTasks.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/tasks?highlight=${t.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <PriorityBadge priority={t.priority as Priority} />
                      <span className="text-sm text-foreground truncate">{t.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{t.assignee_name || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {severityData.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-destructive" />תקלות פתוחות לפי חומרה
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name} (${value})`}>
                  {severityData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || "hsl(var(--muted))"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {productStockData.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />מלאי לפי מוצרים
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={productStockData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                <Tooltip />
                <Bar dataKey="value" name="מלאי" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
