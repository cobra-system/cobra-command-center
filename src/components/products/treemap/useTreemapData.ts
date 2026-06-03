import { useMemo, useState, useEffect } from "react";
import { useData, useAuth, categories as allCategories, type Product } from "@/contexts/AppContext";
import { useProductScope } from "@/hooks/useProductScope";
import { usePickupMonthlyAvg } from "@/hooks/usePickupMonthlyAvg";
import { supabase } from "@/lib/supabase";
import type { TreemapItem } from "./treemapLayout";

export const NO_CATEGORY_GROUP = "__none__";

export interface TreemapFilters {
  topN: number | null;
  category: string;
  supplier: string;
}

export const DEFAULT_FILTERS: TreemapFilters = {
  topN: null,
  category: "הכל",
  supplier: "all",
};

interface DivStockRow {
  division: string;
  product_id: string;
  division_stock: number;
  monthly_avg: number | null;
}

function getConsumption(product: Product, avgByProduct: Map<string, number>): number {
  if (product.monthly_sales_avg && product.monthly_sales_avg > 0) return product.monthly_sales_avg;
  const pickupAvg = avgByProduct.get(product.id);
  if (pickupAvg && pickupAvg > 0) return pickupAvg;
  if (product.monthly_order && product.monthly_order > 0) return product.monthly_order;
  return 1;
}

export function useTreemapData(filters: TreemapFilters) {
  const { scopedProducts } = useProductScope();
  const { avgByProduct } = usePickupMonthlyAvg();
  const { suppliers } = useData();
  const { currentUser } = useAuth();

  const isManager = currentUser?.role === "MANAGER";
  const userDivision = currentUser?.division ?? "";
  const isDivMgr = !!currentUser && !isManager && !!userDivision;

  const [divStockData, setDivStockData] = useState<DivStockRow[]>([]);

  useEffect(() => {
    async function fetch() {
      let q = supabase.from("division_products").select("division, product_id, division_stock, monthly_avg");
      if (isDivMgr) q = q.eq("division", userDivision);
      const { data } = await q;
      setDivStockData((data ?? []) as DivStockRow[]);
    }
    fetch();
  }, [isDivMgr, userDivision]);

  const divStockByProduct = useMemo(() => {
    const map = new Map<string, DivStockRow[]>();
    for (const r of divStockData) {
      const list = map.get(r.product_id) ?? [];
      list.push(r);
      map.set(r.product_id, list);
    }
    return map;
  }, [divStockData]);

  const activeCats = useMemo(
    () => allCategories.filter(c => c !== "הכל"),
    [],
  );

  const uniqueSuppliers = useMemo(() => {
    const set = new Set(scopedProducts.map(p => p.supplier).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [scopedProducts]);

  const items = useMemo(() => {
    let products = scopedProducts;

    if (filters.category !== "הכל" && filters.category !== NO_CATEGORY_GROUP) {
      products = products.filter(p => p.category === filters.category);
    }
    if (filters.supplier !== "all") {
      products = products.filter(p => p.supplier === filters.supplier);
    }

    let mapped: TreemapItem[] = products.map(p => {
      const divEntries = divStockByProduct.get(p.id) ?? [];

      let stockQty: number;
      let consumption: number;

      if (isDivMgr) {
        const myEntry = divEntries.find(d => d.division === userDivision);
        stockQty = myEntry?.division_stock ?? 0;
        consumption = (myEntry?.monthly_avg && myEntry.monthly_avg > 0)
          ? myEntry.monthly_avg
          : getConsumption(p, avgByProduct);
      } else {
        const divTotal = divEntries.reduce((s, d) => s + (d.division_stock ?? 0), 0);
        stockQty = p.stock_qty + divTotal;
        consumption = getConsumption(p, avgByProduct);
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        value: consumption,
        ratio: consumption > 0 ? stockQty / consumption : 0,
        category: filters.category === NO_CATEGORY_GROUP ? NO_CATEGORY_GROUP : (p.category || "ללא קטגוריה"),
        supplier: p.supplier ?? undefined,
        stockQty,
        consumption,
        incomingQty: p.incoming_qty,
      };
    });

    mapped.sort((a, b) => b.value - a.value);

    if (filters.topN) {
      mapped = mapped.slice(0, filters.topN);
    }

    return mapped;
  }, [scopedProducts, avgByProduct, filters, divStockByProduct, isDivMgr, userDivision]);

  return { items, categories: activeCats, suppliers: uniqueSuppliers };
}
