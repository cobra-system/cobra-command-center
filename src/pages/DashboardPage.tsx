import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useData, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Package, Truck, ClipboardList, Users, Zap, AlertTriangle } from "lucide-react";
import RecentSupplierEmails from "@/components/RecentSupplierEmails";
import { supabase } from "@/integrations/supabase/client";

const priorityOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };

export default function DashboardPage() {
  const { products, orders, tasks, suppliers } = useData();
  const navigate = useNavigate();
  const [activeWorkflows, setActiveWorkflows] = useState(0);

  useEffect(() => {
    const fetchWorkflows = async () => {
      const { count } = await supabase
        .from("workflow_instances")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      setActiveWorkflows(count || 0);
    };
    fetchWorkflows();
  }, []);

  const kpis = [
    { label: "מוצרים פעילים", value: products.length, icon: Package, color: "text-primary" },
    { label: "הזמנות בדרך", value: orders.filter(o => o.status === "SHIPPED").length, icon: Truck, color: "text-accent" },
    { label: "משימות פתוחות", value: tasks.filter(t => t.status !== "DONE").length, icon: ClipboardList, color: "text-warning" },
    { label: "ספקים פעילים", value: suppliers.length, icon: Users, color: "text-success" },
  ];

  const catMap: Record<string, { stock: number; order: number }> = {};
  products.forEach(p => {
    if (!catMap[p.category]) catMap[p.category] = { stock: 0, order: 0 };
    catMap[p.category].stock += p.stock_qty;
    catMap[p.category].order += (p.monthly_order ?? 0);
  });
  const chartData = Object.entries(catMap).map(([name, v]) => ({ name, ...v }));

  const openOrders = useMemo(() =>
    orders
      .filter(o => o.status !== "ARRIVED" && o.status !== "CANCELLED")
      .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)),
    [orders]
  );

  const topTasks = useMemo(() =>
    tasks
      .filter(t => t.status !== "DONE")
      .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
      .slice(0, 3),
    [tasks]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">דשבורד</h1>
      
      {/* Active workflows alert */}
      {activeWorkflows > 0 && (
        <div
          onClick={() => navigate("/workflows")}
          className="bg-primary/10 border border-primary/30 rounded-xl p-4 cursor-pointer hover:bg-primary/15 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">תהליכים ממתינים לפעולה</h3>
              <p className="text-sm text-muted-foreground">יש {activeWorkflows} תהליכי רכש פעילים שדורשים טיפול</p>
            </div>
            <span className="bg-primary text-primary-foreground text-sm font-bold px-3 py-1 rounded-full">
              {activeWorkflows}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-card rounded-xl border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2"><k.icon className={`h-5 w-5 ${k.color}`} /><span className="text-sm text-muted-foreground">{k.label}</span></div>
            <p className="text-3xl font-bold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-3">הזמנות פתוחות</h2>
          <div className="space-y-2">
            {openOrders.length === 0 ? <p className="text-sm text-muted-foreground">אין הזמנות פתוחות</p> : openOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/30 rounded transition-colors px-1" onClick={() => navigate(`/orders/${o.id}`)}>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={o.priority as Priority} />
                  <span className="text-sm text-foreground">{o.items.map(i => i.name).join(", ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{o.supplier_name}</span>
                  <OrderStatusBadge status={o.status as OrderStatus} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-3">משימות פתוחות</h2>
          <div className="space-y-2">
            {topTasks.length === 0 ? <p className="text-sm text-muted-foreground">אין משימות פתוחות 🎉</p> : topTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/30 rounded transition-colors px-1" onClick={() => navigate(`/tasks?highlight=${t.id}`)}>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={t.priority as Priority} />
                  <span className="text-sm text-foreground">{t.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">{t.assignee_name || "לא משויך"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Recent Supplier Emails */}
      <RecentSupplierEmails />
      <div className="bg-card rounded-xl border p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">מלאי קיים לעומת הזמנה חודשית</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend /><Bar dataKey="stock" name="מלאי קיים" fill="hsl(var(--primary))" /><Bar dataKey="order" name="הזמנה חודשית" fill="hsl(var(--accent))" /></BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
