import { useState, useEffect, useCallback, useMemo } from "react";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, Package, Truck, ClipboardList, Wrench, Users, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { he } from "date-fns/locale";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))",
  "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))",
];

export default function ReportsPage() {
  const { products, orders, tasks, suppliers } = useData();
  const [monthOffset, setMonthOffset] = useState(0);
  const [issues, setIssues] = useState<Record<string, unknown>[]>([]);
  const [allIssues, setAllIssues] = useState<Record<string, unknown>[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("operations");

  const targetMonth = subMonths(new Date(), monthOffset);
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(targetMonth);
  const monthLabel = format(targetMonth, "MMMM yyyy", { locale: he });

  const fetchExtra = useCallback(async () => {
    setLoading(true);
    const [issueRes, allIssueRes, paymentRes] = await Promise.all([
      supabase.from("product_issues").select("*").gte("reported_date", format(monthStart, "yyyy-MM-dd")).lte("reported_date", format(monthEnd, "yyyy-MM-dd")),
      supabase.from("product_issues").select("*").order("reported_date", { ascending: false }),
      supabase.from("supplier_payments").select("*"),
    ]);
    if (issueRes.data) setIssues(issueRes.data);
    if (allIssueRes.data) setAllIssues(allIssueRes.data);
    if (paymentRes.data) setPayments(paymentRes.data);
    setLoading(false);
  }, [monthStart.toISOString(), monthEnd.toISOString()]);

  useEffect(() => { fetchExtra(); }, [fetchExtra]);

  const inRange = (d: string | null) => {
    if (!d) return false;
    const date = new Date(d);
    return date >= monthStart && date <= monthEnd;
  };

  // Operations report data
  const opsData = useMemo(() => {
    const ordersOpened = orders.filter(o => inRange(o.order_date || null)).length;
    const ordersCompleted = orders.filter(o => o.status === "ARRIVED" && inRange(o.eta || null)).length;
    const ordersDelayed = orders.filter(o => o.status !== "ARRIVED" && o.status !== "CANCELLED" && o.eta && new Date(o.eta) < new Date()).length;
    const tasksInRange = tasks.filter(t => inRange(t.due_date || null));
    const tasksClosed = tasksInRange.filter(t => t.status === "DONE").length;
    const tasksStillOpen = tasksInRange.filter(t => t.status !== "DONE").length;
    return { ordersOpened, ordersCompleted, ordersDelayed, tasksClosed, tasksTotal: tasksInRange.length, tasksStillOpen };
  }, [orders, tasks, monthStart, monthEnd]);

  // Inventory report data
  const invData = useMemo(() => {
    const lowStock = products.filter(p => p.reorder_point && p.stock_qty <= p.reorder_point);
    const outOfStock = products.filter(p => p.stock_qty === 0);
    const catMap: Record<string, number> = {};
    products.forEach(p => { catMap[p.category] = (catMap[p.category] || 0) + p.stock_qty; });
    const byCategory = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const totalValue = products.reduce((s, p) => s + (p.stock_qty * (p.purchase_price || 0)), 0);
    return { lowStock, outOfStock, byCategory, totalValue };
  }, [products]);

  // Issues report data
  const issueData = useMemo(() => {
    const sevMap: Record<string, number> = {};
    issues.forEach(i => { sevMap[i.severity] = (sevMap[i.severity] || 0) + 1; });
    const bySeverity = Object.entries(sevMap).map(([name, value]) => ({ name, value }));

    const prodMap: Record<string, number> = {};
    issues.forEach(i => {
      const prod = products.find(p => p.id === i.product_id);
      const name = prod?.name || "לא ידוע";
      prodMap[name] = (prodMap[name] || 0) + 1;
    });
    const byProduct = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));

    // Monthly trend (last 6 months)
    const now = new Date();
    const monthly: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = format(d, "MM");
      const count = allIssues.filter(issue => issue.reported_date?.startsWith(key)).length;
      monthly.push({ month: label, count });
    }

    return { bySeverity, byProduct, monthly, total: issues.length, openCount: issues.filter(i => i.status !== "נסגר").length };
  }, [issues, allIssues, products]);

  // Supplier report data
  const supplierData = useMemo(() => {
    const byCountry: Record<string, number> = {};
    suppliers.forEach(s => { byCountry[s.country || "לא צוין"] = (byCountry[s.country || "לא צוין"] || 0) + 1; });
    const countryChart = Object.entries(byCountry).map(([name, value]) => ({ name, value }));

    const totalPaid = payments.filter(p => p.status === "שולם" && inRange(p.paid_date)).reduce((s, p) => s + (p.amount || 0), 0);
    const totalPending = payments.filter(p => p.status !== "שולם").reduce((s, p) => s + (p.amount || 0), 0);

    const ordersBySupplier = suppliers.map(s => ({
      name: s.company.length > 15 ? s.company.slice(0, 15) + "…" : s.company,
      count: orders.filter(o => o.supplier_id === s.id || o.supplier_name === s.company).length,
    })).filter(s => s.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);

    return { countryChart, totalPaid, totalPending, ordersBySupplier };
  }, [suppliers, payments, orders, monthStart, monthEnd]);

  const handleDownload = () => {
    const content = `דוח תפעול חודשי — ${monthLabel}
=============================================

📦 הזמנות:
• ${opsData.ordersOpened} הזמנות נפתחו
• ${opsData.ordersCompleted} הזמנות הושלמו
• ${opsData.ordersDelayed} מעוכבות

📊 מלאי:
• ${invData.lowStock.length} מוצרים במלאי נמוך
• ${invData.outOfStock.length} אזלו מהמלאי
• שווי מלאי כולל: $${invData.totalValue.toLocaleString()}

✅ משימות:
• ${opsData.tasksClosed} נסגרו מתוך ${opsData.tasksTotal}
• ${opsData.tasksStillOpen} עדיין פתוחות

⚠️ תקלות:
• ${issueData.total} תקלות דווחו החודש
• ${issueData.openCount} עדיין פתוחות

💳 תשלומים:
• סה״כ שולם: $${supplierData.totalPaid.toLocaleString()}
• ממתין לתשלום: $${supplierData.totalPending.toLocaleString()}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobra-report-${format(targetMonth, "yyyy-MM")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  const KpiCard = ({ icon: Icon, label, value, color, sub }: { icon: typeof BarChart3; label: string; value: string | number; color?: string; sub?: string }) => (
    <div className="bg-card rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color || "text-primary"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">דוחות</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(monthOffset)} onValueChange={v => setMonthOffset(Number(v))}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <SelectItem key={i} value={String(i)}>{format(subMonths(new Date(), i), "MMMM yyyy", { locale: he })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleDownload}><Download className="h-4 w-4 ml-1" />הורד דוח</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="operations" className="gap-1"><Truck className="h-3.5 w-3.5" />תפעול</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1"><Package className="h-3.5 w-3.5" />מלאי</TabsTrigger>
          <TabsTrigger value="issues" className="gap-1"><Wrench className="h-3.5 w-3.5" />תקלות</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1"><Users className="h-3.5 w-3.5" />ספקים</TabsTrigger>
        </TabsList>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Truck} label="הזמנות נפתחו" value={opsData.ordersOpened} />
            <KpiCard icon={Truck} label="הזמנות הושלמו" value={opsData.ordersCompleted} color="text-success" />
            <KpiCard icon={Truck} label="מעוכבות" value={opsData.ordersDelayed} color={opsData.ordersDelayed > 0 ? "text-destructive" : undefined} />
            <KpiCard icon={ClipboardList} label="משימות נסגרו" value={`${opsData.tasksClosed}/${opsData.tasksTotal}`} sub={`${opsData.tasksStillOpen} פתוחות`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-card rounded-xl border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">הזמנות לפי סטטוס</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={(() => {
                      const statusMap: Record<string, number> = {};
                      orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
                      return Object.entries(statusMap).map(([name, value]) => ({ name, value }));
                    })()}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, value }) => `${name} (${value})`}
                  >
                  {(() => {
                      const statusMap: Record<string, number> = {};
                      orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
                      return Object.entries(statusMap).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />);
                    })()}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-xl border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">משימות — {monthLabel}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: "סה״כ", value: opsData.tasksTotal },
                  { name: "הושלמו", value: opsData.tasksClosed },
                  { name: "פתוחות", value: opsData.tasksStillOpen },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Package} label="סה״כ מוצרים" value={products.length} />
            <KpiCard icon={Package} label="מלאי נמוך" value={invData.lowStock.length} color={invData.lowStock.length > 0 ? "text-warning" : undefined} />
            <KpiCard icon={Package} label="אזל מהמלאי" value={invData.outOfStock.length} color={invData.outOfStock.length > 0 ? "text-destructive" : undefined} />
            <KpiCard icon={DollarSign} label="שווי מלאי" value={`$${invData.totalValue.toLocaleString()}`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-card rounded-xl border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">מלאי לפי קטגוריה</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={invData.byCategory} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" name="מלאי" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {invData.lowStock.length > 0 && (
              <div className="bg-card rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">מוצרים במלאי נמוך</h3>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {invData.lowStock.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="text-sm text-foreground">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">מלאי: {p.stock_qty}</span>
                        <span className="text-xs text-destructive">מינ': {p.reorder_point}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard icon={Wrench} label="תקלות החודש" value={issueData.total} />
            <KpiCard icon={Wrench} label="פתוחות" value={issueData.openCount} color={issueData.openCount > 0 ? "text-warning" : undefined} />
            <KpiCard icon={Wrench} label="נסגרו" value={issueData.total - issueData.openCount} color="text-success" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {issueData.bySeverity.length > 0 && (
              <div className="bg-card rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">לפי חומרה</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={issueData.bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                      {issueData.bySeverity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {issueData.byProduct.length > 0 && (
              <div className="bg-card rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">מוצרים עם הכי הרבה תקלות</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={issueData.byProduct} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" name="תקלות" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {issueData.monthly.length > 0 && (
            <div className="bg-card rounded-xl border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">מגמת תקלות חודשית</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={issueData.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="תקלות" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Users} label="סה״כ ספקים" value={suppliers.length} />
            <KpiCard icon={DollarSign} label="שולם החודש" value={`$${supplierData.totalPaid.toLocaleString()}`} color="text-success" />
            <KpiCard icon={DollarSign} label="ממתין לתשלום" value={`$${supplierData.totalPending.toLocaleString()}`} color={supplierData.totalPending > 0 ? "text-warning" : undefined} />
            <KpiCard icon={Truck} label="הזמנות פעילות" value={orders.filter(o => o.status !== "ARRIVED" && o.status !== "CANCELLED").length} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {supplierData.countryChart.length > 0 && (
              <div className="bg-card rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">ספקים לפי מדינה</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={supplierData.countryChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                      {supplierData.countryChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {supplierData.ordersBySupplier.length > 0 && (
              <div className="bg-card rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">הזמנות לפי ספק</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={supplierData.ordersBySupplier} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                    <Tooltip />
                    <Bar dataKey="count" name="הזמנות" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
