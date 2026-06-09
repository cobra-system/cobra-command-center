import { useMemo, useState, useEffect } from "react";
import { useData, useAuth, categories as allCategories, type Product } from "@/contexts/AppContext";
import { useProductScope } from "@/hooks/useProductScope";
import { usePickupMonthlyAvg } from "@/hooks/usePickupMonthlyAvg";
import { supabase } from "@/lib/supabase";
import type { TreemapItem } from "./treemapLayout";

export const NO_CATEGORY_GROUP = "__none__";

export type SizeMetric = "consumption" | "stockValue";
export type HealthFilter = "all" | "outOfStock" | "critical" | "low" | "ok" | "healthy";

export interface TreemapFilters {
  topN: number | null;
  category: string;
  supplier: string;
  sizeBy: SizeMetric;
  division: string;
  health: HealthFilter;
}

export const DEFAULT_FILTERS: TreemapFilters = {
  topN: null,
  category: "הכל",
  supplier: "all",
  sizeBy: "consumption",
  division: "all",
  health: "all",
};

interface DivStockRow {
  division: string;
  product_id: string;
  division_stock: number;
  monthly_avg: number | null;
}

interface IssueCountRow {
  product_id: string;
  count: number;
}

interface LastOrderRow {
  product_id: string;
  max_date: string;
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
  const [issueCountData, setIssueCountData] = useState<IssueCountRow[]>([]);
  const [lastOrderData, setLastOrderData] = useState<LastOrderRow[]>([]);

  useEffect(() => {
    async function fetchAll() {
      const divPromise = (async () => {
        let q = supabase.from("division_products").select("division, product_id, division_stock, monthly_avg");
        if (isDivMgr) q = q.eq("division", userDivision);
        const { data } = await q;
        setDivStockData((data ?? []) as DivStockRow[]);
      })();

      const issuePromise = (async () => {
        const { data } = await supabase.rpc("get_open_issue_counts");
        if (data) setIssueCountData(data as IssueCountRow[]);
      })().catch(() => {
        // RPC may not exist — fall back to direct query
        supabase
          .from("product_issues")
          .select("product_id")
          .neq("status", "נסגר")
          .then(({ data }) => {
            if (!data) return;
            const counts = new Map<string, number>();
            for (const row of data) {
              counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
            }
            setIssueCountData([...counts.entries()].map(([product_id, count]) => ({ product_id, count })));
          });
      });

      const orderPromise = (async () => {
        const { data } = await supabase
          .from("order_items")
          .select("product_id, orders!inner(order_date)")
          .not("product_id", "is", null);
        if (data) {
          const latest = new Map<string, string>();
          for (const row of data as Array<{ product_id: string; orders: { order_date: string } }>) {
            const d = row.orders?.order_date;
            if (!d || !row.product_id) continue;
            const prev = latest.get(row.product_id);
            if (!prev || d > prev) latest.set(row.product_id, d);
          }
          setLastOrderData([...latest.entries()].map(([product_id, max_date]) => ({ product_id, max_date })));
        }
      })().catch(() => {});

      await Promise.all([divPromise, issuePromise, orderPromise]);
    }
    fetchAll();
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

  const issuesByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of issueCountData) map.set(r.product_id, r.count);
    return map;
  }, [issueCountData]);

  const lastOrderByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of lastOrderData) map.set(r.product_id, r.max_date);
    return map;
  }, [lastOrderData]);

  const activeCats = useMemo(
    () => allCategories.filter(c => c !== "הכל"),
    [],
  );

  const uniqueSuppliers = useMemo(() => {
    const set = new Set(scopedProducts.map(p => p.supplier).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [scopedProducts]);

  const uniqueDivisions = useMemo(() => {
    const set = new Set<string>();
    for (const rows of divStockByProduct.values()) {
      for (const r of rows) set.add(r.division);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [divStockByProduct]);

  const supplierIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of suppliers) map.set(s.company, s.id);
    return map;
  }, [suppliers]);

  const items = useMemo(() => {
    let products = scopedProducts;

    if (filters.category !== "הכל" && filters.category !== NO_CATEGORY_GROUP) {
      products = products.filter(p => p.category === filters.category);
    }
    if (filters.supplier !== "all") {
      products = products.filter(p => p.supplier === filters.supplier);
    }

    const viewingSpecificDiv = filters.division !== "all" && isManager;

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
      } else if (viewingSpecificDiv) {
        const divEntry = divEntries.find(d => d.division === filters.division);
        stockQty = divEntry?.division_stock ?? 0;
        consumption = (divEntry?.monthly_avg && divEntry.monthly_avg > 0)
          ? divEntry.monthly_avg
          : getConsumption(p, avgByProduct);
      } else {
        const divTotal = divEntries.reduce((s, d) => s + (d.division_stock ?? 0), 0);
        stockQty = p.stock_qty + divTotal;
        consumption = getConsumption(p, avgByProduct);
      }

      const purchasePrice = p.purchase_price ?? undefined;

      let value: number;
      if (filters.sizeBy === "stockValue" && purchasePrice && purchasePrice > 0) {
        value = stockQty * purchasePrice;
      } else {
        value = consumption;
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        value: Math.max(value, 0.01),
        ratio: consumption > 0 ? stockQty / consumption : 0,
        category: filters.category === NO_CATEGORY_GROUP ? NO_CATEGORY_GROUP : (p.category || "ללא קטגוריה"),
        supplier: p.supplier ?? undefined,
        supplierId: p.supplier ? supplierIdByName.get(p.supplier) : undefined,
        stockQty,
        consumption,
        incomingQty: p.incoming_qty,
        purchasePrice,
        leadTimeDays: p.lead_time_days ?? undefined,
        productType: p.product_type ?? undefined,
        openIssues: issuesByProduct.get(p.id) ?? 0,
        lastOrderDate: lastOrderByProduct.get(p.id),
        reorderPoint: p.reorder_point ?? undefined,
      };
    });

    if (viewingSpecificDiv) {
      mapped = mapped.filter(m => m.stockQty > 0 || m.consumption > 0);
    }

    if (filters.health !== "all") {
      mapped = mapped.filter(m => {
        if (m.consumption <= 0) return filters.health === "ok";
        const months = m.stockQty / m.consumption;
        switch (filters.health) {
          case "outOfStock": return m.stockQty <= 0;
          case "critical": return months < 1 && m.stockQty > 0;
          case "low": return months >= 1 && months < 2;
          case "ok": return months >= 2 && months < 3;
          case "healthy": return months >= 3;
          default: return true;
        }
      });
    }

    mapped.sort((a, b) => b.value - a.value);

    if (filters.topN) {
      mapped = mapped.slice(0, filters.topN);
    }

    return mapped;
  }, [scopedProducts, avgByProduct, filters, divStockByProduct, isDivMgr, userDivision, isManager, supplierIdByName, issuesByProduct, lastOrderByProduct]);

  return { items, categories: activeCats, suppliers: uniqueSuppliers, divisions: uniqueDivisions, isManager };
}
