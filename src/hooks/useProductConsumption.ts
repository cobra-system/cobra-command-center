import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface ConsumptionRow {
  month: string;
  quantity: number;
  division: string;
}

interface ProductConsumptionData {
  rawRows: ConsumptionRow[];
  divisions: string[];
  loading: boolean;
}

export function aggregateByMonth(
  rows: ConsumptionRow[],
  selectedDivisions: string[] | null,
): { month: string; quantity: number }[] {
  const filtered = selectedDivisions
    ? rows.filter((r) => selectedDivisions.includes(r.division))
    : rows;
  const byMonth = new Map<string, number>();
  for (const r of filtered) {
    byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.quantity);
  }
  return [...byMonth.entries()]
    .map(([month, quantity]) => ({ month, quantity }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function calcAvgs(data: { month: string; quantity: number }[]) {
  const avg = (items: typeof data) =>
    items.length > 0 ? items.reduce((s, d) => s + d.quantity, 0) / items.length : 0;
  return {
    avgAnnual: avg(data),
    avgHalfYear: avg(data.slice(-6)),
    avgQuarter: avg(data.slice(-3)),
  };
}

export function useProductConsumption(productId: string | undefined): ProductConsumptionData {
  const [rawRows, setRawRows] = useState<ConsumptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!productId) {
      setRawRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("division_product_consumption")
      .select("month, quantity, division")
      .eq("product_id", productId)
      .order("month", { ascending: true });
    setRawRows((data ?? []) as ConsumptionRow[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const divisions = [...new Set(rawRows.map((r) => r.division))].sort();

  return { rawRows, divisions, loading };
}
