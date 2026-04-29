import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Bell, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderStatusBadge } from "@/components/StatusBadge";
import type { OrderStatus } from "@/contexts/AppContext";

interface OverduePayment {
  id: string;
  order_id: string | null;
  payment_type: string;
  amount: number;
  currency: string;
  due_date: string;
  orders?: { supplier_name: string | null; pi_number: string | null } | null;
}

interface OverdueETA {
  id: string;
  supplier_name: string | null;
  eta: string;
  status: string;
  priority: string;
  pi_number: string | null;
}

interface PIWithoutSWIFT {
  id: string;
  order_id: string | null;
  payment_type: string;
  amount: number;
  currency: string;
  due_date: string | null;
  orders?: { supplier_name: string | null; pi_number: string | null } | null;
}

const currencySymbol = (c: string) => c === "USD" ? "$" : c === "EUR" ? "€" : "₪";
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("he-IL") : "—";

function AlertCard({
  title,
  description,
  severity,
  meta,
  onClick,
}: {
  title: string;
  description: string;
  severity: "error" | "warning" | "info";
  meta?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "bg-card border rounded-lg p-4 flex gap-3 cursor-pointer hover:bg-muted/30 transition-colors",
        severity === "error" && "border-r-4 border-r-destructive",
        severity === "warning" && "border-r-4 border-r-warning",
        severity === "info" && "border-r-4 border-r-accent",
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {meta && <p className="text-xs text-muted-foreground/70 mt-1 font-mono">{meta}</p>}
      </div>
    </div>
  );
}

export default function AlertsContent() {
  const navigate = useNavigate();
  const [overduePayments, setOverduePayments] = useState<OverduePayment[]>([]);
  const [overdueETAs, setOverdueETAs] = useState<OverdueETA[]>([]);
  const [piWithoutSWIFT, setPiWithoutSWIFT] = useState<PIWithoutSWIFT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const today = new Date().toISOString().split("T")[0];
      const now = new Date().toISOString();

      const [overduePayRes, overdueETARes, swiftRes] = await Promise.all([
        supabase
          .from("order_payments")
          .select("id, order_id, payment_type, amount, currency, due_date, orders(supplier_name, pi_number)")
          .eq("status", "ממתין")
          .not("due_date", "is", null)
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(50),
        supabase
          .from("orders")
          .select("id, supplier_name, eta, status, priority, pi_number")
          .not("eta", "is", null)
          .lt("eta", now)
          .not("status", "in", '("ARRIVED","DELIVERED","CANCELLED")')
          .order("eta", { ascending: true })
          .limit(50),
        supabase
          .from("order_payments")
          .select("id, order_id, payment_type, amount, currency, due_date, orders(supplier_name, pi_number)")
          .eq("status", "ממתין")
          .is("swift_reference", null)
          .not("due_date", "is", null)
          .order("due_date", { ascending: true })
          .limit(30),
      ]);

      if (overduePayRes.data) setOverduePayments(overduePayRes.data as OverduePayment[]);
      if (overdueETARes.data) setOverdueETAs(overdueETARes.data as OverdueETA[]);
      if (swiftRes.data) setPiWithoutSWIFT(swiftRes.data as PIWithoutSWIFT[]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const totalAlerts = overduePayments.length + overdueETAs.length + piWithoutSWIFT.length;
  const daysOverdue = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

  if (loading) return <div className="py-8 text-center text-muted-foreground">טוען...</div>;

  if (totalAlerts === 0) {
    return (
      <div className="bg-card rounded-xl border p-12 text-center">
        <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">אין התראות פעילות</p>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <span className="font-semibold text-foreground">
          התראות פעילות
          <span className="mr-2 text-sm font-semibold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
            {totalAlerts}
          </span>
        </span>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">הכל ({totalAlerts})</TabsTrigger>
          {overduePayments.length > 0 && <TabsTrigger value="payments">תשלומים ({overduePayments.length})</TabsTrigger>}
          {overdueETAs.length > 0 && <TabsTrigger value="orders">הזמנות ({overdueETAs.length})</TabsTrigger>}
          {piWithoutSWIFT.length > 0 && <TabsTrigger value="swift">חסר SWIFT ({piWithoutSWIFT.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {overduePayments.map(p => {
            const supplierName = (p.orders as { supplier_name?: string | null } | null)?.supplier_name;
            const piNumber = (p.orders as { pi_number?: string | null } | null)?.pi_number;
            const days = daysOverdue(p.due_date);
            return (
              <AlertCard
                key={`pay-${p.id}`}
                severity="error"
                title={`תשלום באיחור — ${supplierName || "ספק לא ידוע"}`}
                description={`${p.payment_type === "Deposit" ? "מקדמה" : "יתרה"} ${currencySymbol(p.currency)}${(p.amount || 0).toLocaleString()} · מועד: ${formatDate(p.due_date)} (${days}י׳ עיכוב)`}
                meta={piNumber || undefined}
                onClick={() => p.order_id && navigate(`/orders/${p.order_id}`)}
              />
            );
          })}
          {overdueETAs.map(o => (
            <AlertCard
              key={`eta-${o.id}`}
              severity="warning"
              title={`ETA עבר — ${o.supplier_name || "ספק לא ידוע"}`}
              description={`ETA: ${formatDate(o.eta)} (${daysOverdue(o.eta)}י׳ עיכוב)`}
              meta={o.pi_number || undefined}
              onClick={() => navigate(`/orders/${o.id}`)}
            />
          ))}
          {piWithoutSWIFT.map(p => {
            const supplierName = (p.orders as { supplier_name?: string | null } | null)?.supplier_name;
            const piNumber = (p.orders as { pi_number?: string | null } | null)?.pi_number;
            return (
              <AlertCard
                key={`swift-${p.id}`}
                severity="info"
                title={`ממתין ל-SWIFT — ${supplierName || "ספק לא ידוע"}`}
                description={`${p.payment_type === "Deposit" ? "מקדמה" : "יתרה"} ${currencySymbol(p.currency)}${(p.amount || 0).toLocaleString()}${p.due_date ? ` · מועד: ${formatDate(p.due_date)}` : ""}`}
                meta={piNumber || undefined}
                onClick={() => p.order_id && navigate(`/orders/${p.order_id}`)}
              />
            );
          })}
        </TabsContent>

        <TabsContent value="payments" className="space-y-3 mt-4">
          {overduePayments.map(p => {
            const supplierName = (p.orders as { supplier_name?: string | null } | null)?.supplier_name;
            const piNumber = (p.orders as { pi_number?: string | null } | null)?.pi_number;
            const days = daysOverdue(p.due_date);
            return (
              <AlertCard
                key={p.id}
                severity="error"
                title={`תשלום באיחור — ${supplierName || "ספק לא ידוע"}`}
                description={`${p.payment_type === "Deposit" ? "מקדמה" : "יתרה"} ${currencySymbol(p.currency)}${(p.amount || 0).toLocaleString()} · מועד: ${formatDate(p.due_date)} (${days}י׳ עיכוב)`}
                meta={piNumber || undefined}
                onClick={() => p.order_id && navigate(`/orders/${p.order_id}`)}
              />
            );
          })}
        </TabsContent>

        <TabsContent value="orders" className="space-y-3 mt-4">
          {overdueETAs.map(o => (
            <div
              key={o.id}
              className="bg-card border border-r-4 border-r-warning rounded-lg p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => navigate(`/orders/${o.id}`)}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{o.supplier_name || "—"}</p>
                <p className="text-xs text-muted-foreground">ETA: {formatDate(o.eta)} ({daysOverdue(o.eta)}י׳ עיכוב)</p>
                {o.pi_number && <p className="text-xs text-muted-foreground font-mono mt-0.5">{o.pi_number}</p>}
              </div>
              <OrderStatusBadge status={o.status as OrderStatus} />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="swift" className="space-y-3 mt-4">
          {piWithoutSWIFT.map(p => {
            const supplierName = (p.orders as { supplier_name?: string | null } | null)?.supplier_name;
            const piNumber = (p.orders as { pi_number?: string | null } | null)?.pi_number;
            return (
              <AlertCard
                key={p.id}
                severity="info"
                title={`ממתין ל-SWIFT — ${supplierName || "ספק לא ידוע"}`}
                description={`${p.payment_type === "Deposit" ? "מקדמה" : "יתרה"} ${currencySymbol(p.currency)}${(p.amount || 0).toLocaleString()}${p.due_date ? ` · מועד: ${formatDate(p.due_date)}` : ""}`}
                meta={piNumber || undefined}
                onClick={() => p.order_id && navigate(`/orders/${p.order_id}`)}
              />
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
