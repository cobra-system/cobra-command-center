import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const MONTHS_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function formatMonthLabel(yyyyMM: string): string {
  const [year, mon] = yyyyMM.split("-");
  const m = parseInt(mon, 10) - 1;
  return `${MONTHS_HE[m] ?? "?"} ${year.slice(2)}`;
}

export interface MonthlyPaymentData {
  month: string;
  label: string;
  paid: number;
  pending: number;
  total: number;
}

interface RawPaymentRow {
  amount: number;
  currency: string;
  status: string;
  paid_date: string | null;
  due_date: string | null;
  payment_type: string;
}

export function useSupplierPayments(supplierId: string) {
  const [rows, setRows] = useState<RawPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplierId) return;
    setLoading(true);
    supabase
      .from("supplier_payments")
      .select("amount, currency, status, paid_date, due_date, payment_type")
      .eq("supplier_id", supplierId)
      .then(({ data }) => {
        setRows((data ?? []) as RawPaymentRow[]);
        setLoading(false);
      });
  }, [supplierId]);

  const monthlyData: MonthlyPaymentData[] = (() => {
    const map = new Map<string, { paid: number; pending: number }>();

    for (const r of rows) {
      const isPaid = r.status === "שולם";
      const dateStr = isPaid ? r.paid_date : r.due_date;
      if (!dateStr) continue;

      const month = dateStr.slice(0, 7); // "YYYY-MM"
      const entry = map.get(month) ?? { paid: 0, pending: 0 };
      if (isPaid) entry.paid += r.amount;
      else entry.pending += r.amount;
      map.set(month, entry);
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { paid, pending }]) => ({
        month,
        label: formatMonthLabel(month),
        paid,
        pending,
        total: paid + pending,
      }));
  })();

  const totalPaid = rows.filter(r => r.status === "שולם").reduce((s, r) => s + r.amount, 0);
  const totalPending = rows.filter(r => r.status !== "שולם").reduce((s, r) => s + r.amount, 0);

  const primaryCurrency = (() => {
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.currency] = (counts[r.currency] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
  })();

  return { monthlyData, totalPaid, totalPending, primaryCurrency, loading };
}
