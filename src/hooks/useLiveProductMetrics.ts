import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/contexts/types";

const ACTIVE_STATUSES = [
  "SHIPPED",
  "ARRIVED_PORT",
  "CUSTOMS_CLEARANCE",
] as const;

export interface CompositeIncoming {
  matched: number;
  total: number;
  minUnits: number | null;
}

export interface ProductMetrics {
  incomingQty: number;
  purchasePrice: number | null;
  compositeIncoming: CompositeIncoming | null;
}

export function useLiveProductMetrics(products: Product[]): {
  metrics: Record<string, ProductMetrics>;
  loading: boolean;
  refresh: () => void;
} {
  const [metrics, setMetrics] = useState<Record<string, ProductMetrics>>({});
  const [loading, setLoading] = useState(true);
  const productsRef = useRef(products);
  productsRef.current = products;

  const stableKey = products.map(p => p.id).join(",");

  const compute = useCallback(async () => {
    const prods = productsRef.current;
    if (prods.length === 0) {
      setMetrics({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data } = await supabase
      .from("order_items")
      .select("product_id, qty, price, orders!inner(status, created_at)")
      .not("product_id", "is", null)
      .not("orders.status", "eq", "CANCELLED");

    const incoming: Record<string, number> = {};
    const latestOrder: Record<string, { price: number; created_at: string }> = {};

    if (data) {
      for (const row of data as Array<{
        product_id: string;
        qty: number;
        price: number | null;
        orders: { status: string; created_at: string };
      }>) {
        const pid = row.product_id;
        const status = row.orders?.status;
        const createdAt = row.orders?.created_at ?? "";

        if (ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number])) {
          incoming[pid] = (incoming[pid] ?? 0) + (row.qty ?? 0);
        }

        if (row.price != null) {
          const prev = latestOrder[pid];
          if (!prev || createdAt > prev.created_at) {
            latestOrder[pid] = { price: row.price, created_at: createdAt };
          }
        }
      }
    }

    const skuToId: Record<string, string> = {};
    for (const p of prods) {
      if (p.sku) skuToId[p.sku] = p.id;
    }

    const result: Record<string, ProductMetrics> = {};

    for (const p of prods) {
      if (p.product_type === "מורכב") {
        const components = p.components ?? [];
        const total = components.length;

        if (total === 0) {
          result[p.id] = {
            incomingQty: 0,
            purchasePrice: null,
            compositeIncoming: { matched: 0, total: 0, minUnits: null },
          };
          continue;
        }

        let priceSum = 0;
        let hasAnyPrice = false;
        for (const comp of components) {
          if (comp.price != null) {
            priceSum += comp.price;
            hasAnyPrice = true;
          }
        }

        let matched = 0;
        let allResolved = true;
        const incomingValues: number[] = [];

        for (const comp of components) {
          if (!comp.sku) {
            allResolved = false;
            continue;
          }
          const compProductId = skuToId[comp.sku];
          if (!compProductId) {
            allResolved = false;
            continue;
          }
          matched++;
          incomingValues.push(incoming[compProductId] ?? 0);
        }

        const minUnits =
          allResolved && incomingValues.length > 0
            ? Math.min(...incomingValues)
            : null;

        result[p.id] = {
          incomingQty: minUnits ?? 0,
          purchasePrice: hasAnyPrice ? priceSum : null,
          compositeIncoming: { matched, total, minUnits },
        };
      } else {
        const liveIncoming = incoming[p.id] ?? 0;
        const livePrice = latestOrder[p.id]?.price ?? null;

        result[p.id] = {
          incomingQty: liveIncoming,
          purchasePrice: livePrice ?? p.purchase_price ?? null,
          compositeIncoming: null,
        };
      }
    }

    setMetrics(result);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  useEffect(() => {
    compute();
  }, [compute]);

  return { metrics, loading, refresh: compute };
}
