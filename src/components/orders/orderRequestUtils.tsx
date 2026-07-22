import type { OrderRequest, OrderRequestStatus, OrderRequestUrgency } from "@/contexts/types";

// utilization_pct is a whole-number percentage (0–100, may exceed 100 when over-committed).
// The 20260509100000 migration normalized any legacy fraction-form values.
export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${Math.round(v)}%`;
}

export function fmtMoney(
  v: number | null | undefined,
  formatFn?: (amount: number, sourceCurrency: string) => string
): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (formatFn) return formatFn(Number(v), "ILS");
  return `₪${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function utilizationColor(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "text-muted-foreground";
  if (v < 30) return "text-red-600 font-semibold";
  if (v < 70) return "text-yellow-600";
  return "text-green-600";
}

export function urgencyClass(u?: OrderRequestUrgency | null): string {
  if (u === "דחוף") return "bg-red-50 text-red-700 border-red-200";
  if (u === "רגיל") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

export const STATUS_LABELS: Record<OrderRequestStatus, string> = {
  pending: "ממתינה",
  ordered: "הוזמן",
  rejected: "נדחתה",
  cancelled: "בוטלה",
};

export function statusClass(s?: OrderRequestStatus | null): string {
  switch (s) {
    case "ordered":
      return "bg-green-50 text-green-700 border-green-200";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";
    case "cancelled":
      return "bg-gray-100 text-gray-500 border-gray-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

export function isOverdue(date?: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function ageBadge(req: OrderRequest): { text: string; cls: string } | null {
  if (req.status !== "pending") return null;
  const days = daysSince(req.created_at);
  if (days === null) return null;
  if (days >= 14) return { text: `${days} ימים`, cls: "bg-red-50 text-red-700 border-red-200" };
  if (days >= 7) return { text: `${days} ימים`, cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (days >= 1) return { text: `${days} ימים`, cls: "bg-gray-50 text-gray-600 border-gray-200" };
  return { text: "היום", cls: "bg-blue-50 text-blue-700 border-blue-200" };
}

export const URGENCY_OPTIONS: OrderRequestUrgency[] = ["דחוף", "רגיל", "נמוך"];
export const ORDER_TYPE_OPTIONS = ["מיידית", "חודשית", "רבעונית", "חצי שנתית"] as const;

// Suggest a stronger urgency when stock is below quarterly need.
export function suggestUrgency(req: OrderRequest): OrderRequestUrgency | null {
  const stock = req.division_stock ?? 0;
  const need = req.smoothed_required ?? req.quarterly_forecast ?? 0;
  if (stock <= 0 && need > 0) return "דחוף";
  if (need > 0 && stock < need * 0.3) return "דחוף";
  return null;
}

export function freeTextMatch(req: OrderRequest, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.toLowerCase();
  return [
    req.product_name,
    req.product_sku,
    req.supplier,
    req.division,
    req.notes,
    req.reason,
    req.payment_status,
    req.shipping_type,
    req.created_by_name,
    req.ordered_by_name,
  ]
    .filter((x): x is string => !!x)
    .some(s => s.toLowerCase().includes(needle));
}
