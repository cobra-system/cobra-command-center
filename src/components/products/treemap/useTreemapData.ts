import { useMemo } from "react";
import { useData, categories as allCategories, type Product } from "@/contexts/AppContext";
import { useProductScope } from "@/hooks/useProductScope";
import { usePickupMonthlyAvg } from "@/hooks/usePickupMonthlyAvg";
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
      const consumption = getConsumption(p, avgByProduct);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        value: consumption,
        ratio: consumption > 0 ? p.stock_qty / consumption : 0,
        category: filters.category === NO_CATEGORY_GROUP ? NO_CATEGORY_GROUP : (p.category || "ללא קטגוריה"),
        supplier: p.supplier ?? undefined,
        stockQty: p.stock_qty,
        consumption,
        incomingQty: p.incoming_qty,
      };
    });

    mapped.sort((a, b) => b.value - a.value);

    if (filters.topN) {
      mapped = mapped.slice(0, filters.topN);
    }

    return mapped;
  }, [scopedProducts, avgByProduct, filters]);

  return { items, categories: activeCats, suppliers: uniqueSuppliers };
}
