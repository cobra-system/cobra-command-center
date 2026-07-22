import { useMemo } from "react";
import type { OrderRequest } from "@/contexts/types";
import { ClipboardList, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { daysSince } from "./orderRequestUtils";

interface Props {
  requests: OrderRequest[];
  scope: "division" | "manager";
  divisionLabel?: string;
  variant?: "card" | "compact";
}

export function OrderRequestsDashboard({ requests, scope, divisionLabel, variant = "card" }: Props) {
  const stats = useMemo(() => {
    const pending = requests.filter(r => r.status === "pending");
    const ordered = requests.filter(r => r.status === "ordered");
    const rejected = requests.filter(r => r.status === "rejected");
    const urgent = pending.filter(r => r.urgency === "דחוף").length;
    const overdue = pending.filter(r => {
      const d = daysSince(r.created_at);
      return d !== null && d >= 7;
    }).length;
    const avgFulfillDays = (() => {
      const fulfilled = ordered.filter(r => r.created_at && r.ordered_at);
      if (fulfilled.length === 0) return null;
      const totalMs = fulfilled.reduce((s, r) => {
        const created = new Date(r.created_at).getTime();
        const ord = new Date(r.ordered_at!).getTime();
        return s + Math.max(0, ord - created);
      }, 0);
      return Math.round(totalMs / fulfilled.length / 86_400_000);
    })();

    return {
      total: requests.length,
      pending: pending.length,
      ordered: ordered.length,
      rejected: rejected.length,
      urgent,
      overdue,
      avgFulfillDays,
    };
  }, [requests]);

  const cards: { label: string; value: string; sub?: string; icon: typeof ClipboardList; tone: string }[] = [
    {
      label: "ממתינות לטיפול",
      value: String(stats.pending),
      sub: stats.urgent > 0 ? `${stats.urgent} דחופות` : "ללא דחופות",
      icon: Clock,
      tone: stats.pending > 0 ? "text-amber-600" : "text-muted-foreground",
    },
    {
      label: "דחופות",
      value: String(stats.urgent),
      sub: stats.urgent > 0 ? "דורשות פעולה מיידית" : "אין כרגע",
      icon: AlertTriangle,
      tone: stats.urgent > 0 ? "text-red-600" : "text-muted-foreground",
    },
    {
      label: "מאוחרות (7+ ימים)",
      value: String(stats.overdue),
      sub: stats.overdue > 0 ? "ממתינות זמן רב" : "כולן עדכניות",
      icon: TrendingUp,
      tone: stats.overdue > 0 ? "text-red-600" : "text-muted-foreground",
    },
    {
      label: scope === "manager" ? "זמן מימוש ממוצע" : "הוזמנו עבור החטיבה",
      value:
        scope === "manager"
          ? stats.avgFulfillDays !== null ? `${stats.avgFulfillDays} ימים` : "—"
          : String(stats.ordered),
      sub: scope === "manager" ? `${stats.ordered} בקשות הושלמו` : `${stats.rejected} נדחו`,
      icon: CheckCircle2,
      tone: "text-green-600",
    },
  ];

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs" dir="rtl">
        {cards.map((c, i) => (
          <span key={c.label} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="h-3 w-px bg-border" aria-hidden />}
            <c.icon className={`h-3.5 w-3.5 ${c.tone}`} />
            <span className="text-muted-foreground">{c.label}:</span>
            <span className={`font-semibold tabular-nums ${c.tone}`}>{c.value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border shadow-sm p-4 sm:p-5" dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {scope === "division" && divisionLabel ? `סקירת בקשות — ${divisionLabel}` : "סקירת בקשות הזמנה"}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-muted-foreground">{c.label}</span>
              <c.icon className={`h-3.5 w-3.5 ${c.tone}`} />
            </div>
            <div className={`text-xl font-semibold mt-1 tabular-nums ${c.tone}`}>{c.value}</div>
            {c.sub && <div className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
