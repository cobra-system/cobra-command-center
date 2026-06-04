import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface MonthlyConsumption {
  month: string;
  quantity: number;
}

interface ProductConsumptionData {
  monthlyData: MonthlyConsumption[];
  avgAnnual: number;
  avgHalfYear: number;
  avgQuarter: number;
  loading: boolean;
}

export function useProductConsumption(productId: string | undefined, division?: string): ProductConsumptionData {
  const [monthlyData, setMonthlyData] = useState<MonthlyConsumption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!productId) {
      setMonthlyData([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let query = supabase
      .from("division_product_consumption")
      .select("month, quantity")
      .eq("product_id", productId)
      .order("month", { ascending: true });

    if (division) {
      query = query.eq("division", division);
    }

    const { data } = await query;
    const rows = (data ?? []) as { month: string; quantity: number }[];

    if (division) {
      setMonthlyData(rows);
    } else {
      const byMonth = new Map<string, number>();
      for (const r of rows) {
        byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.quantity);
      }
      const aggregated = [...byMonth.entries()]
        .map(([month, quantity]) => ({ month, quantity }))
        .sort((a, b) => a.month.localeCompare(b.month));
      setMonthlyData(aggregated);
    }

    setLoading(false);
  }, [productId, division]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const avg = (items: MonthlyConsumption[]) =>
    items.length > 0 ? items.reduce((s, d) => s + d.quantity, 0) / items.length : 0;

  const avgAnnual = avg(monthlyData);
  const avgHalfYear = avg(monthlyData.slice(-6));
  const avgQuarter = avg(monthlyData.slice(-3));

  return { monthlyData, avgAnnual, avgHalfYear, avgQuarter, loading };
}
