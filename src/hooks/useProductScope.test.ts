import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Product, Order, Supplier } from "@/contexts/types";

const ctx = vi.hoisted(() => ({
  currentUser: null as null | {
    role: string;
    division?: string | null;
    allowed_product_ids?: string[] | null;
  },
  products: [] as Product[],
  orders: [] as Order[],
  suppliers: [] as Supplier[],
}));

vi.mock("@/contexts/AppContext", () => ({
  useAuth: () => ({ currentUser: ctx.currentUser }),
  useData: () => ({ products: ctx.products, orders: ctx.orders, suppliers: ctx.suppliers }),
}));

import { useProductScope } from "./useProductScope";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const productA: Product = {
  id: "p-A",
  name: "Widget A",
  sku: "SKU-A",
  category: "x",
  product_type: "פשוט",
  stock_qty: 0,
  incoming_qty: 0,
  supplier_id: "sup-1",
  components: [{ id: "c1", product_id: "p-A", name: "Bolt", sku: "BOLT-1", supplier: "Acme Co" }],
};

const productB: Product = {
  id: "p-B",
  name: "Widget B",
  sku: "SKU-B",
  category: "x",
  product_type: "פשוט",
  stock_qty: 0,
  incoming_qty: 0,
  supplier_id: "sup-2",
  components: [],
};

function order(
  id: string,
  items: Array<{ product_id?: string | null; name?: string | null }>,
  extras: Partial<Order> = {},
): Order {
  return {
    id,
    priority: "normal",
    status: "PENDING",
    items: items.map((it, i) => ({
      id: `${id}-i${i}`,
      order_id: id,
      product_id: it.product_id ?? null,
      name: it.name ?? "",
      qty: 1,
    })),
    ...extras,
  } as Order;
}

const supplier1: Supplier = { id: "sup-1", contact_name: "X", company: "Acme Co" };
const supplier2: Supplier = { id: "sup-2", contact_name: "Y", company: "BetaCorp" };
const supplier3: Supplier = { id: "sup-3", contact_name: "Z", company: "Destination Ltd" };

beforeEach(() => {
  ctx.currentUser = null;
  ctx.products = [productA, productB];
  ctx.orders = [];
  ctx.suppliers = [supplier1, supplier2, supplier3];
});

describe("useProductScope — unscoped users", () => {
  it("MANAGER with no allowed_product_ids returns full lists and isScoped=false", () => {
    ctx.currentUser = { role: "MANAGER" };
    ctx.orders = [order("o-1", [{ product_id: "p-A" }]), order("o-2", [{ product_id: "p-B" }])];

    const { result } = renderHook(() => useProductScope());

    expect(result.current.isScoped).toBe(false);
    expect(result.current.scopedProducts).toEqual([productA, productB]);
    expect(result.current.scopedOrders).toHaveLength(2);
    expect(result.current.scopedSuppliers).toEqual([supplier1, supplier2, supplier3]);
  });

  it("scopeOrderItems is identity when not scoped", () => {
    ctx.currentUser = { role: "MANAGER" };
    const { result } = renderHook(() => useProductScope());

    const items = [{ product_id: "p-A" }, { product_id: "p-Z" }, { name: "freeform" }];
    expect(result.current.scopeOrderItems(items)).toEqual(items);
  });
});

describe("useProductScope — allowed_product_ids scope", () => {
  it("filters products, orders, and suppliers to the allowed product set", () => {
    ctx.currentUser = { role: "MANAGER", allowed_product_ids: ["p-A"] };
    ctx.orders = [
      order("o-1", [{ product_id: "p-A" }]),
      order("o-2", [{ product_id: "p-B" }]),
    ];

    const { result } = renderHook(() => useProductScope());

    expect(result.current.isScoped).toBe(true);
    expect(result.current.scopedProducts).toEqual([productA]);
    expect(result.current.scopedOrders.map((o) => o.id)).toEqual(["o-1"]);
    expect(result.current.scopedProductIds.has("p-A")).toBe(true);
    expect(result.current.scopedProductIds.has("p-B")).toBe(false);
  });

  it("matches order items by free-text name when product_id is missing", () => {
    ctx.currentUser = { role: "MANAGER", allowed_product_ids: ["p-A"] };
    ctx.orders = [
      order("o-name", [{ product_id: null, name: "Widget A" }]),
      order("o-sku", [{ product_id: null, name: "SKU-A" }]),
      order("o-component-name", [{ product_id: null, name: "Bolt" }]),
      order("o-component-sku", [{ product_id: null, name: "BOLT-1" }]),
      order("o-miss", [{ product_id: null, name: "completely unrelated" }]),
    ];

    const { result } = renderHook(() => useProductScope());

    const ids = result.current.scopedOrders.map((o) => o.id);
    expect(ids).toContain("o-name");
    expect(ids).toContain("o-sku");
    expect(ids).toContain("o-component-name");
    expect(ids).toContain("o-component-sku");
    expect(ids).not.toContain("o-miss");
  });

  it("scopeOrderItems filters when scoped", () => {
    ctx.currentUser = { role: "MANAGER", allowed_product_ids: ["p-A"] };
    const { result } = renderHook(() => useProductScope());

    const items = [
      { product_id: "p-A" },
      { product_id: "p-B" },
      { product_id: null, name: "Widget A" },
      { product_id: null, name: "noise" },
    ];
    expect(result.current.scopeOrderItems(items)).toEqual([
      { product_id: "p-A" },
      { product_id: null, name: "Widget A" },
    ]);
  });
});

describe("useProductScope — supplier list (regression)", () => {
  it("includes destination_supplier_id from a scoped order even when no scoped product references it", () => {
    ctx.currentUser = { role: "MANAGER", allowed_product_ids: ["p-A"] };
    ctx.orders = [
      order("o-1", [{ product_id: "p-A" }], {
        supplier_id: "sup-1",
        destination_supplier_id: "sup-3",
      }),
    ];

    const { result } = renderHook(() => useProductScope());

    const supplierIds = result.current.scopedSuppliers.map((s) => s.id).sort();
    expect(supplierIds).toContain("sup-1"); // direct (productA.supplier_id)
    expect(supplierIds).toContain("sup-3"); // destination from order
    expect(supplierIds).not.toContain("sup-2"); // unrelated
  });

  it("includes the component's supplier (matched by company name)", () => {
    ctx.currentUser = { role: "MANAGER", allowed_product_ids: ["p-A"] };
    ctx.orders = [];

    const { result } = renderHook(() => useProductScope());

    const supplierIds = result.current.scopedSuppliers.map((s) => s.id);
    // productA.components[0].supplier === "Acme Co" matches supplier1.company
    expect(supplierIds).toContain("sup-1");
  });
});

describe("useProductScope — division-scoped non-manager", () => {
  it("isScoped becomes true via division even without allowed_product_ids; products pass through", () => {
    ctx.currentUser = { role: "WAREHOUSE_MANAGER", division: "Logistics" };
    ctx.orders = [
      order("o-1", [{ product_id: "p-A" }]),
      order("o-2", [{ product_id: "p-Z" }]), // unknown product → no match
    ];

    const { result } = renderHook(() => useProductScope());

    expect(result.current.isScoped).toBe(true);
    // products were not filtered by allowed_ids — useProductScope assumes ProductsContext already filtered
    expect(result.current.scopedProducts).toEqual([productA, productB]);
    // Orders are still narrowed to those touching scoped products
    expect(result.current.scopedOrders.map((o) => o.id)).toEqual(["o-1"]);
  });

  it("non-manager with no division is NOT scoped", () => {
    ctx.currentUser = { role: "WAREHOUSE_MANAGER", division: null };
    ctx.orders = [order("o-2", [{ product_id: "p-Z" }])];

    const { result } = renderHook(() => useProductScope());

    expect(result.current.isScoped).toBe(false);
    expect(result.current.scopedOrders).toHaveLength(1);
  });
});
