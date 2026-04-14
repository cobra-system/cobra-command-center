import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/contexts/types";

const ACTIVE_STATUSES = [
  "PENDING",
  "ORDERED",
  "SHIPPED",
  "ARRIVED_PORT",
  "CUSTOMS_CLEARANCE",
  "DELIVERED",
] as const;

export interface CompositeIncoming {
  matched: number;        // components whose SKU maps to a known product
  total: number;          // total components
  minUnits: number | null; // min incoming across all matched; null if any component unresolved
}

export interface ProductMetrics {
  incomingQty: number;
  purchasePrice: number | null;
  compositeIncoming: CompositeIncoming | null; // null for finished products
}

export function useLiveProductMetrics(products: Product[]): {
  metrics: Record<string, ProductMetrics>;
  loading: boolean;
  refresh: () => void;
} {
  const [metrics, setMetrics] = useState<Record<string, ProductMetrics>>({});
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    setLoading(true);

    // Single query: all non-cancelled order_items with order status + created_at
    const { data } = await supabase
      .from("order_items")
      .select("product_id, qty, price, orders!inner(status, created_at)")
      .not("product_id", "is", null)
      .not("orders.status", "eq", "CANCELLED");

    // Per finished-product aggregations from order_items
    const incoming: Record<string, number> = {};
    // Track latest-priced order per product: { price, created_at }
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

        // Incoming: only active statuses
        if (ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number])) {
          incoming[pid] = (incoming[pid] ?? 0) + (row.qty ?? 0);
        }

        // Latest price: track most recent order that has a price
        if (row.price != null) {
          const prev = latestOrder[pid];
          if (!prev || createdAt > prev.created_at) {
            latestOrder[pid] = { price: row.price, created_at: createdAt };
          }
        }
      }
    }

    // Build SKU → productId map for composite resolution
    const skuToId: Record<string, string> = {};
    for (const p of products) {
      if (p.sku) skuToId[p.sku] = p.id;
    }

    // Build final metrics per product
    const result: Record<string, ProductMetrics> = {};

    for (const p of products) {
      if (p.product_type === "מורכב") {
        // --- Composite product ---
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

        // Purchase price: sum of component prices
        let priceSum = 0;
        let hasAnyPrice = false;
        for (const comp of components) {
          if (comp.price != null) {
            priceSum += comp.price;
            hasAnyPrice = true;
          }
        }

        // Incoming: resolve each component SKU → product → incoming
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
        // --- Finished product ---
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
  }, [products]);

  useEffect(() => {
    compute();
  }, [compute]);

  return { metrics, loading, refresh: compute };
}
