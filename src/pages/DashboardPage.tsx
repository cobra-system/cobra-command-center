import { useAuth, useData, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Package, Truck, ClipboardList, Users } from "lucide-react";
import RecentSupplierEmails from "@/components/RecentSupplierEmails";

export default function DashboardPage() {
  const { products, orders, tasks, suppliers } = useData();
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
  const openOrders = orders.filter(o => o.status !== "ARRIVED" && o.status !== "CANCELLED");
  const p0Tasks = tasks.filter(t => t.priority === "P0" && t.status !== "DONE");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">דשבורד</h1>
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
              <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-0">
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
          <h2 className="text-lg font-semibold text-foreground mb-3">משימות P0 פתוחות</h2>
          <div className="space-y-2">
            {p0Tasks.length === 0 ? <p className="text-sm text-muted-foreground">אין משימות דחופות 🎉</p> : p0Tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm text-foreground">{t.title}</span>
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
