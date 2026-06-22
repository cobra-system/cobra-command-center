import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const MONTHS_HE_SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const MONTHS_HE_FULL  = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

function parseMonth(dateStr: string): { year: number; mon: number } {
  // dateStr is "YYYY-MM-DD" (always 1st of month from DB)
  const [year, mon] = dateStr.split("-").map(Number);
  return { year, mon };
}

export interface SapMonthRow {
  month: string;       // "YYYY-MM"
  label: string;       // "ינואר 2025"
  shortLabel: string;  // "ינו׳ 25"
  amount: number;
}

export interface PeakMonth {
  label: string;
  amount: number;
}

export interface UseSupplierSapPaymentsResult {
  rows: SapMonthRow[];
  total2025: number;
  total2026: number;
  avgMonthly: number;
  peakMonth: PeakMonth | null;
  loading: boolean;
}

export function useSupplierSapPayments(
  supplierId: string,
  supplierNumber: string | null,
): UseSupplierSapPaymentsResult {
  const [rows, setRows] = useState<SapMonthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplierId) return;
    setLoading(true);

    let query = supabase
      .from("supplier_monthly_payments")
      .select("month, amount")
      .order("month", { ascending: true });

    if (supplierNumber) {
      query = query.or(`supplier_id.eq.${supplierId},sap_supplier_code.eq.${supplierNumber}`);
    } else {
      query = query.eq("supplier_id", supplierId);
    }

    query.then(({ data }) => {
      const parsed: SapMonthRow[] = (data ?? []).map((r: { month: string; amount: number }) => {
        const { year, mon } = parseMonth(r.month);
        const idx = mon - 1;
        return {
          month: r.month.slice(0, 7),
          label: `${MONTHS_HE_FULL[idx] ?? "?"} ${year}`,
          shortLabel: `${MONTHS_HE_SHORT[idx] ?? "?"} ${String(year).slice(2)}`,
          amount: r.amount,
        };
      });
      setRows(parsed);
      setLoading(false);
    });
  }, [supplierId, supplierNumber]);

  const total2025 = rows.filter(r => r.month.startsWith("2025")).reduce((s, r) => s + r.amount, 0);
  const total2026 = rows.filter(r => r.month.startsWith("2026")).reduce((s, r) => s + r.amount, 0);
  const avgMonthly = rows.length > 0 ? rows.reduce((s, r) => s + r.amount, 0) / rows.length : 0;

  const peakMonth: PeakMonth | null = rows.length > 0
    ? (() => {
        const peak = rows.reduce((best, r) => r.amount > best.amount ? r : best, rows[0]);
        return { label: peak.label, amount: peak.amount };
      })()
    : null;

  return { rows, total2025, total2026, avgMonthly, peakMonth, loading };
}
