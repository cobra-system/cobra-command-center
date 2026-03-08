import { useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Package, ShoppingCart, ListTodo, Truck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const { products, orders, tasks, suppliers } = useData();

  const kpis = [
    { label: "מוצרים פעילים", value: products.length, icon: Package, color: "text-accent" },
    { label: "הזמנות בדרך", value: orders.filter(o => o.status === "SHIPPED").length, icon: ShoppingCart, color: "text-warning" },
    { label: "משימות פתוחות", value: tasks.filter(t => t.status !== "DONE").length, icon: ListTodo, color: "text-destructive" },
    { label: "ספקים פעילים", value: suppliers.length, icon: Truck, color: "text-success" },
  ];

  const openOrders = orders.filter(o => o.status !== "ARRIVED" && o.status !== "CANCELLED");
  const p0Tasks = tasks.filter(t => t.priority === "P0" && t.status !== "DONE");

  // Chart data: stock vs monthly order by category
  const categories = ["מיגון ואיתור", "מולטימדיה", "בטיחות", "נוחות וקישוריות", "בית"];
  const chartData = categories.map(cat => {
    const catProducts = products.filter(p => p.category === cat);
    return {
      category: cat,
      "מלאי קיים": catProducts.reduce((sum, p) => sum + p.stockQty, 0),
      "הזמנה חודשית": catProducts.reduce((sum, p) => sum + (p.monthlyOrder || 0), 0),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">דשבורד</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-card rounded-xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Open Orders */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-5 border-b">
            <h2 className="font-bold text-foreground">הזמנות פתוחות</h2>
          </div>
          <div className="divide-y">
            {openOrders.length === 0 ? (
              <p className="p-5 text-muted-foreground text-sm text-center">אין הזמנות פתוחות</p>
            ) : (
              openOrders.map(order => (
                <div key={order.id} className="p-4 flex items-center gap-3">
                  <PriorityBadge priority={order.priority} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {order.items.map(i => i.name).join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">{order.supplierName}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                  {order.eta && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ETA: {new Date(order.eta).toLocaleDateString("he-IL")}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* P0 Tasks */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-5 border-b">
            <h2 className="font-bold text-foreground">משימות P0 פתוחות</h2>
          </div>
          <div className="divide-y">
            {p0Tasks.length === 0 ? (
              <p className="p-5 text-muted-foreground text-sm text-center">אין משימות דחופות 🎉</p>
            ) : (
              p0Tasks.map(task => (
                <div key={task.id} className="p-4 flex items-center gap-3">
                  <PriorityBadge priority="P0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    {task.assigneeName && (
                      <p className="text-xs text-muted-foreground">{task.assigneeName}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <h2 className="font-bold text-foreground mb-4">מלאי קיים לעומת הזמנה חודשית</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                direction: "rtl",
              }}
            />
            <Legend />
            <Bar dataKey="מלאי קיים" fill="hsl(214 55% 40%)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="הזמנה חודשית" fill="hsl(24 80% 42%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
