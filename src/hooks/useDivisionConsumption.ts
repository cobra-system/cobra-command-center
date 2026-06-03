import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface ConsumptionRow {
  product_id: string;
  month: string; // "YYYY-MM-DD"
  quantity: number;
}

export interface DivisionProductRow {
  id: string;
  product_id: string;
  division_stock: number;
  quarterly_demand: number | null;
  monthly_avg: number | null;
  monthly_avg_updated_at: string | null;
  products: { id: string; name: string; sku: string; stock_qty: number | null; category_id: string | null };
}

export interface ProductConsumptionSummary {
  product_id: string;
  name: string;
  sku: string;
  category_id: string | null;
  division_stock: number;
  quarterly_demand: number | null;
  monthly_avg: number | null;
  main_stock: number | null;
  monthlyData: { month: string; quantity: number }[];
  total: number;
  avg3: number;
  trend: "up" | "down" | "flat";
  healthRatio: number | null;
  healthColor: string;
  healthLabel: string;
}

const HEALTH_THRESHOLDS: { min: number; color: string; label: string }[] = [
  { min: 4, color: "#16a34a", label: "מצוין" },
  { min: 3, color: "#4ade80", label: "תקין" },
  { min: 2, color: "#eab308", label: "סביר" },
  { min: 1, color: "#f97316", label: "נמוך" },
  { min: 0.01, color: "#ef4444", label: "קריטי" },
  { min: 0, color: "#dc2626", label: "אזל" },
];

function getHealth(stock: number, monthlyAvg: number | null): { ratio: number | null; color: string; label: string } {
  if (!monthlyAvg || monthlyAvg <= 0) return { ratio: null, color: "#6b7280", label: "אין נתונים" };
  if (stock <= 0) return { ratio: 0, color: "#dc2626", label: "אזל" };
  const ratio = stock / monthlyAvg;
  for (const t of HEALTH_THRESHOLDS) {
    if (ratio >= t.min) return { ratio, color: t.color, label: t.label };
  }
  return { ratio, color: "#dc2626", label: "אזל" };
}

function calcTrend(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const last = values[values.length - 1];
  const prev = values.slice(0, -1);
  const prevAvg = prev.reduce((s, v) => s + v, 0) / prev.length;
  if (last > prevAvg * 1.05) return "up";
  if (last < prevAvg * 0.95) return "down";
  return "flat";
}

export function useDivisionConsumption(division: string) {
  const [divisionProducts, setDivisionProducts] = useState<DivisionProductRow[]>([]);
  const [consumption, setConsumption] = useState<ConsumptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!division) return;
    setLoading(true);

    const [dpRes, cRes] = await Promise.all([
      supabase
        .from("division_products")
        .select("id, product_id, division_stock, quarterly_demand, monthly_avg, monthly_avg_updated_at, products(id, name, sku, stock_qty, category_id)")
        .eq("division", division),
      supabase
        .from("division_product_consumption")
        .select("product_id, month, quantity")
        .eq("division", division)
        .order("month", { ascending: true }),
    ]);

    setDivisionProducts((dpRes.data ?? []) as unknown as DivisionProductRow[]);
    setConsumption((cRes.data ?? []) as ConsumptionRow[]);
    setLoading(false);
  }, [division]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allMonths = useMemo(() => {
    const set = new Set<string>();
    for (const c of consumption) set.add(c.month);
    return [...set].sort();
  }, [consumption]);

  const productSummaries = useMemo((): ProductConsumptionSummary[] => {
    const consumptionByProduct = new Map<string, Map<string, number>>();
    for (const c of consumption) {
      if (!consumptionByProduct.has(c.product_id)) consumptionByProduct.set(c.product_id, new Map());
      consumptionByProduct.get(c.product_id)!.set(c.month, c.quantity);
    }

    return divisionProducts
      .filter(dp => dp.products)
      .map(dp => {
        const monthMap = consumptionByProduct.get(dp.product_id) ?? new Map<string, number>();
        const monthlyData = allMonths.map(m => ({ month: m, quantity: monthMap.get(m) ?? 0 }));
        const values = monthlyData.map(d => d.quantity).filter(q => q > 0);
        const total = values.reduce((s, v) => s + v, 0);
        const last3 = monthlyData.slice(-3).map(d => d.quantity);
        const avg3 = last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 0;
        const trend = calcTrend(monthlyData.map(d => d.quantity));
        const health = getHealth(dp.division_stock, dp.monthly_avg);

        return {
          product_id: dp.product_id,
          name: dp.products.name,
          sku: dp.products.sku,
          category_id: dp.products.category_id,
          division_stock: dp.division_stock,
          quarterly_demand: dp.quarterly_demand,
          monthly_avg: dp.monthly_avg,
          main_stock: dp.products.stock_qty,
          monthlyData,
          total,
          avg3: Math.round(avg3 * 10) / 10,
          trend,
          healthRatio: health.ratio,
          healthColor: health.color,
          healthLabel: health.label,
        };
      });
  }, [divisionProducts, consumption, allMonths]);

  const monthlyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const c of consumption) {
      if (c.quantity > 0) {
        totals.set(c.month, (totals.get(c.month) ?? 0) + c.quantity);
      }
    }
    return allMonths.map(m => ({
      month: m,
      total: totals.get(m) ?? 0,
    }));
  }, [consumption, allMonths]);

  return {
    divisionProducts,
    consumption,
    productSummaries,
    monthlyTotals,
    allMonths,
    loading,
    refetch: fetchData,
  };
}
