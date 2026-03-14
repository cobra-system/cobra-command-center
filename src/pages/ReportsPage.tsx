import { useState, useEffect, useCallback, useMemo } from "react";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Download } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { he } from "date-fns/locale";

interface ReportData {
  ordersOpened: number;
  ordersCompleted: number;
  ordersDelayed: number;
  lowStockProducts: string[];
  arrivedShipments: number;
  tasksClosed: number;
  tasksOpened: number;
  tasksStillOpen: number;
  issuesReported: number;
  topIssueProduct: string;
  totalPaid: number;
  totalPending: number;
}

export default function ReportsPage() {
  const { products, orders, tasks } = useData();
  const [monthOffset, setMonthOffset] = useState(0);
  const [issues, setIssues] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const targetMonth = subMonths(new Date(), monthOffset);
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(targetMonth);
  const monthLabel = format(targetMonth, "MMMM yyyy", { locale: he });

  const fetchExtra = useCallback(async () => {
    setLoading(true);
    const [issueRes, paymentRes] = await Promise.all([
      supabase.from("product_issues").select("*").gte("reported_date", monthStart.toISOString()).lte("reported_date", monthEnd.toISOString()),
      supabase.from("supplier_payments").select("*"),
    ]);
    if (issueRes.data) setIssues(issueRes.data);
    if (paymentRes.data) setPayments(paymentRes.data);
    setLoading(false);
  }, [monthStart.toISOString(), monthEnd.toISOString()]);

  useEffect(() => { fetchExtra(); }, [fetchExtra]);

  const report = useMemo<ReportData>(() => {
    const inRange = (d: string | null) => {
      if (!d) return false;
      const date = new Date(d);
      return date >= monthStart && date <= monthEnd;
    };

    const ordersOpened = orders.filter(o => inRange(o.order_date || null)).length;
    const ordersCompleted = orders.filter(o => o.status === "ARRIVED" && inRange(o.eta || null)).length;
    const ordersDelayed = orders.filter(o => o.status !== "ARRIVED" && o.status !== "CANCELLED" && o.eta && new Date(o.eta) < new Date()).length;

    const lowStockProducts = products
      .filter(p => p.reorder_point && p.stock_qty <= p.reorder_point)
      .map(p => p.name);

    const arrivedShipments = orders.filter(o => o.status === "ARRIVED" && inRange(o.eta || null)).length;

    const tasksInRange = tasks.filter(t => inRange(t.due_date || null));
    const tasksClosed = tasksInRange.filter(t => t.status === "DONE").length;
    const tasksOpened = tasksInRange.length;
    const tasksStillOpen = tasksInRange.filter(t => t.status !== "DONE").length;

    const issuesReported = issues.length;
    // Find product with most issues
    const issueCountByProduct: Record<string, number> = {};
    issues.forEach(i => {
      const prod = products.find(p => p.id === i.product_id);
      const name = prod?.name || "לא ידוע";
      issueCountByProduct[name] = (issueCountByProduct[name] || 0) + 1;
    });
    const topIssueProduct = Object.entries(issueCountByProduct).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    const totalPaid = payments.filter(p => p.status === "שולם" && inRange(p.paid_date)).reduce((s, p) => s + (p.amount || 0), 0);
    const totalPending = payments.filter(p => p.status !== "שולם").reduce((s, p) => s + (p.amount || 0), 0);

    return { ordersOpened, ordersCompleted, ordersDelayed, lowStockProducts, arrivedShipments, tasksClosed, tasksOpened, tasksStillOpen, issuesReported, topIssueProduct, totalPaid, totalPending };
  }, [orders, tasks, products, issues, payments, monthStart, monthEnd]);

  const handleDownload = () => {
    const content = `
דוח תפעול חודשי — ${monthLabel}
=============================================

📦 הזמנות:
• ${report.ordersOpened} הזמנות נפתחו
• ${report.ordersCompleted} הזמנות הושלמו
• ${report.ordersDelayed} מעוכבות

📊 מלאי:
• מוצרים עם מלאי נמוך: ${report.lowStockProducts.length > 0 ? report.lowStockProducts.join(", ") : "אין"}
• משלוחים שהגיעו: ${report.arrivedShipments}

✅ משימות:
• ${report.tasksClosed} נסגרו
• ${report.tasksOpened} סה״כ
• ${report.tasksStillOpen} עדיין פתוחות

⚠️ תקלות:
• ${report.issuesReported} תקלות דווחו
• המוצר עם הכי הרבה תקלות: ${report.topIssueProduct}

💳 תשלומים:
• סה״כ שולם: $${report.totalPaid.toLocaleString()}
• ממתין לתשלום: $${report.totalPending.toLocaleString()}
    `.trim();

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobra-report-${format(targetMonth, "yyyy-MM")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  const Section = ({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) => (
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{emoji} {title}</h2>
      {children}
    </div>
  );

  const Stat = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <div className="flex justify-between items-center py-1.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${color || "text-foreground"}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">דוח תפעול חודשי</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(monthOffset)} onValueChange={v => setMonthOffset(Number(v))}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <SelectItem key={i} value={String(i)}>{format(subMonths(new Date(), i), "MMMM yyyy", { locale: he })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleDownload}><Download className="h-4 w-4 ml-1" />הורד דוח</Button>
        </div>
      </div>

      <div className="text-center bg-primary/10 rounded-xl p-4">
        <p className="text-lg font-bold text-primary">{monthLabel}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="הזמנות" emoji="📦">
          <Stat label="הזמנות שנפתחו" value={report.ordersOpened} />
          <Stat label="הזמנות שהושלמו" value={report.ordersCompleted} color="text-success" />
          <Stat label="הזמנות מעוכבות" value={report.ordersDelayed} color={report.ordersDelayed > 0 ? "text-destructive" : undefined} />
        </Section>

        <Section title="מלאי" emoji="📊">
          <Stat label="מוצרים עם מלאי נמוך" value={report.lowStockProducts.length} color={report.lowStockProducts.length > 0 ? "text-warning" : undefined} />
          {report.lowStockProducts.length > 0 && (
            <p className="text-xs text-muted-foreground">{report.lowStockProducts.join(", ")}</p>
          )}
          <Stat label="משלוחים שהגיעו" value={report.arrivedShipments} />
        </Section>

        <Section title="משימות" emoji="✅">
          <Stat label="סה״כ משימות" value={report.tasksOpened} />
          <Stat label="נסגרו" value={report.tasksClosed} color="text-success" />
          <Stat label="עדיין פתוחות" value={report.tasksStillOpen} color={report.tasksStillOpen > 0 ? "text-warning" : undefined} />
        </Section>

        <Section title="תקלות" emoji="⚠️">
          <Stat label="תקלות שדווחו" value={report.issuesReported} />
          <Stat label="המוצר עם הכי הרבה תקלות" value={report.topIssueProduct} />
        </Section>

        <Section title="תשלומים" emoji="💳">
          <Stat label="סה״כ שולם" value={`$${report.totalPaid.toLocaleString()}`} color="text-success" />
          <Stat label="ממתין לתשלום" value={`$${report.totalPending.toLocaleString()}`} color={report.totalPending > 0 ? "text-warning" : undefined} />
        </Section>
      </div>
    </div>
  );
}
