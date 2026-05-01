import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { Product } from "@/contexts/types";

const mock = vi.hoisted(() =>
  ({ instance: null as ReturnType<typeof import("@/test/supabaseMock").createSupabaseMock> | null }),
);

vi.mock("@/lib/supabase", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  mock.instance = createSupabaseMock();
  return { supabase: mock.instance };
});

import { useLiveProductMetrics } from "./useLiveProductMetrics";

beforeEach(() => {
  mock.instance!.state.reset();
});

function queueOrderItems(rows: unknown[]) {
  const r = mock.instance!.state.responses;
  r.order_items = r.order_items ?? [];
  r.order_items.push({ data: rows });
}

function makeFinished(id: string, sku: string, extras: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    sku,
    category: "x",
    product_type: "פשוט",
    stock_qty: 0,
    incoming_qty: 0,
    ...extras,
  } as Product;
}

function makeComposite(
  id: string,
  components: Array<{ sku?: string | null; price?: number | null }>,
): Product {
  return {
    id,
    name: id,
    sku: id,
    category: "x",
    product_type: "מורכב",
    stock_qty: 0,
    incoming_qty: 0,
    components: components.map((c, i) => ({
      id: `${id}-c${i}`,
      product_id: id,
      name: `comp-${i}`,
      sku: c.sku ?? null,
      price: c.price ?? null,
    })),
  } as Product;
}

describe("useLiveProductMetrics — finished products", () => {
  it("sums qty across active-status orders and exposes the latest price", async () => {
    queueOrderItems([
      { product_id: "p-A", qty: 10, price: 100, orders: { status: "SHIPPED", created_at: "2026-01-01" } },
      { product_id: "p-A", qty: 5, price: 120, orders: { status: "ARRIVED_PORT", created_at: "2026-04-01" } },
    ]);

    const products = [makeFinished("p-A", "SKU-A")];
    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics["p-A"].incomingQty).toBe(15);
    // latest by created_at wins
    expect(result.current.metrics["p-A"].purchasePrice).toBe(120);
    expect(result.current.metrics["p-A"].compositeIncoming).toBeNull();
  });

  it("falls back to product.purchase_price when no order has a price", async () => {
    queueOrderItems([]);

    const products = [makeFinished("p-A", "SKU-A", { purchase_price: 42 })];
    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics["p-A"].purchasePrice).toBe(42);
    expect(result.current.metrics["p-A"].incomingQty).toBe(0);
  });

  it("returns null purchasePrice when neither order price nor product.purchase_price is set", async () => {
    queueOrderItems([]);

    const products = [makeFinished("p-A", "SKU-A")];
    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics["p-A"].purchasePrice).toBeNull();
  });

  it("ignores qty from non-active-status orders even if they leak through the query", async () => {
    queueOrderItems([
      { product_id: "p-A", qty: 5, price: 100, orders: { status: "DELIVERED", created_at: "2026-01-01" } },
    ]);

    const products = [makeFinished("p-A", "SKU-A")];
    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics["p-A"].incomingQty).toBe(0);
    // DELIVERED row still counts for latest-price tracking
    expect(result.current.metrics["p-A"].purchasePrice).toBe(100);
  });
});

describe("useLiveProductMetrics — composite products", () => {
  it("with all components resolved: minUnits = min(incoming), incomingQty = minUnits", async () => {
    queueOrderItems([
      { product_id: "comp-1", qty: 30, price: 10, orders: { status: "SHIPPED", created_at: "2026-01-01" } },
      { product_id: "comp-2", qty: 5, price: 20, orders: { status: "SHIPPED", created_at: "2026-01-01" } },
    ]);

    const products = [
      makeFinished("comp-1", "SKU-X"),
      makeFinished("comp-2", "SKU-Y"),
      makeComposite("kit-1", [{ sku: "SKU-X", price: 10 }, { sku: "SKU-Y", price: 20 }]),
    ];

    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics["kit-1"].compositeIncoming).toEqual({
      matched: 2,
      total: 2,
      minUnits: 5,
    });
    expect(result.current.metrics["kit-1"].incomingQty).toBe(5);
    expect(result.current.metrics["kit-1"].purchasePrice).toBe(30);
  });

  it("with one unresolved component: minUnits=null AND incomingQty falls back to 0", async () => {
    queueOrderItems([
      { product_id: "comp-1", qty: 30, price: 10, orders: { status: "SHIPPED", created_at: "2026-01-01" } },
    ]);

    const products = [
      makeFinished("comp-1", "SKU-X"),
      makeComposite("kit-1", [{ sku: "SKU-X", price: 10 }, { sku: "MISSING-SKU", price: 5 }]),
    ];

    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics["kit-1"].compositeIncoming).toEqual({
      matched: 1,
      total: 2,
      minUnits: null,
    });
    expect(result.current.metrics["kit-1"].incomingQty).toBe(0);
  });

  it("zero-component composite: matched=0, total=0, minUnits=null, no price", async () => {
    queueOrderItems([]);

    const products = [makeComposite("kit-empty", [])];
    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics["kit-empty"]).toEqual({
      incomingQty: 0,
      purchasePrice: null,
      compositeIncoming: { matched: 0, total: 0, minUnits: null },
    });
  });

  it("composite price is null when no component carries a price", async () => {
    queueOrderItems([]);

    const products = [
      makeFinished("comp-1", "SKU-X"),
      makeComposite("kit-1", [{ sku: "SKU-X" }]),
    ];

    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics["kit-1"].purchasePrice).toBeNull();
  });
});

describe("useLiveProductMetrics — refresh()", () => {
  it("re-runs the query and updates metrics with the new data", async () => {
    queueOrderItems([
      { product_id: "p-A", qty: 5, price: 100, orders: { status: "SHIPPED", created_at: "2026-01-01" } },
    ]);

    const products = [makeFinished("p-A", "SKU-A")];
    const { result } = renderHook(() => useLiveProductMetrics(products));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics["p-A"].incomingQty).toBe(5);

    queueOrderItems([
      { product_id: "p-A", qty: 8, price: 100, orders: { status: "SHIPPED", created_at: "2026-01-01" } },
    ]);

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.metrics["p-A"].incomingQty).toBe(8));
  });
});
