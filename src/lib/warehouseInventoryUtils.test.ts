import { describe, it, expect } from "vitest";
import type { Product } from "@/contexts/types";
import type { WarehouseZone } from "@/data/warehouseZones";
import {
  buildZoneInventoryMap,
  type CenterInventoryRow,
  type ZoneProductRow,
} from "./warehouseInventoryUtils";

const zoneA: WarehouseZone = {
  id: "zone-A",
  name: "Zone A",
  color: "#fff",
  textColor: "#000",
  gridRow: "1 / 2",
  gridColumn: "1 / 2",
  zoneType: "shelving",
};
const zoneB: WarehouseZone = {
  id: "zone-B",
  name: "Zone B",
  color: "#fff",
  textColor: "#000",
  gridRow: "1 / 2",
  gridColumn: "2 / 3",
  zoneType: "storage",
};

function product(id: string, extras: Partial<Product> = {}): Product {
  return {
    id,
    name: `Product ${id}`,
    sku: `SKU-${id}`,
    category: "x",
    product_type: "פשוט",
    stock_qty: 0,
    incoming_qty: 0,
    ...extras,
  } as Product;
}

const NO_SCOPE = { isScoped: false, scopedProductIds: new Set<string>() };

describe("buildZoneInventoryMap", () => {
  it("returns one entry per zone, even when the zone has no products", () => {
    const map = buildZoneInventoryMap({
      zones: [zoneA, zoneB],
      zoneProductRows: [],
      inventory: [],
      products: [],
      ...NO_SCOPE,
    });
    expect([...map.keys()]).toEqual(["zone-A", "zone-B"]);
    expect(map.get("zone-A")!.products).toEqual([]);
    expect(map.get("zone-A")!.totalQuantity).toBe(0);
    expect(map.get("zone-A")!.hasLowStock).toBe(false);
  });

  it("joins assigned products with their inventory and sums totalQuantity", () => {
    const zoneProductRows: ZoneProductRow[] = [
      { zone_id: "zone-A", product_id: "p1" },
      { zone_id: "zone-A", product_id: "p2" },
    ];
    const inventory: CenterInventoryRow[] = [
      { product_id: "p1", quantity: 10, min_stock: 0 },
      { product_id: "p2", quantity: 5, min_stock: 0 },
    ];
    const products = [product("p1", { stock_qty: 7, incoming_qty: 3 }), product("p2")];

    const data = buildZoneInventoryMap({
      zones: [zoneA],
      zoneProductRows,
      inventory,
      products,
      ...NO_SCOPE,
    }).get("zone-A")!;

    expect(data.products.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(data.products[0]).toMatchObject({
      id: "p1",
      sku: "SKU-p1",
      quantity: 10,
      minStock: 0,
      stockQty: 7,
      incomingQty: 3,
    });
    expect(data.totalQuantity).toBe(15);
  });

  it("flags isLowStock when quantity is below a positive min_stock", () => {
    const data = buildZoneInventoryMap({
      zones: [zoneA],
      zoneProductRows: [{ zone_id: "zone-A", product_id: "p1" }],
      inventory: [{ product_id: "p1", quantity: 2, min_stock: 5 }],
      products: [product("p1")],
      ...NO_SCOPE,
    }).get("zone-A")!;

    expect(data.products[0].isLowStock).toBe(true);
    expect(data.hasLowStock).toBe(true);
  });

  it("does NOT flag low stock when min_stock is 0 (default), even when quantity is 0", () => {
    const data = buildZoneInventoryMap({
      zones: [zoneA],
      zoneProductRows: [{ zone_id: "zone-A", product_id: "p1" }],
      inventory: [{ product_id: "p1", quantity: 0, min_stock: 0 }],
      products: [product("p1")],
      ...NO_SCOPE,
    }).get("zone-A")!;

    expect(data.products[0].isLowStock).toBe(false);
    expect(data.hasLowStock).toBe(false);
  });

  it("hasLowStock is true when at least one product in the zone is low", () => {
    const data = buildZoneInventoryMap({
      zones: [zoneA],
      zoneProductRows: [
        { zone_id: "zone-A", product_id: "p1" },
        { zone_id: "zone-A", product_id: "p2" },
      ],
      inventory: [
        { product_id: "p1", quantity: 10, min_stock: 5 }, // ok
        { product_id: "p2", quantity: 1, min_stock: 5 }, // low
      ],
      products: [product("p1"), product("p2")],
      ...NO_SCOPE,
    }).get("zone-A")!;

    expect(data.products[0].isLowStock).toBe(false);
    expect(data.products[1].isLowStock).toBe(true);
    expect(data.hasLowStock).toBe(true);
  });

  it("treats missing inventory rows as zero quantity / zero min_stock", () => {
    const data = buildZoneInventoryMap({
      zones: [zoneA],
      zoneProductRows: [{ zone_id: "zone-A", product_id: "p1" }],
      inventory: [], // no row for p1
      products: [product("p1")],
      ...NO_SCOPE,
    }).get("zone-A")!;

    expect(data.products[0]).toMatchObject({ quantity: 0, minStock: 0, isLowStock: false });
  });

  it("skips assignments whose product is not in the products list", () => {
    const data = buildZoneInventoryMap({
      zones: [zoneA],
      zoneProductRows: [
        { zone_id: "zone-A", product_id: "p1" },
        { zone_id: "zone-A", product_id: "p-unknown" },
      ],
      inventory: [{ product_id: "p1", quantity: 4, min_stock: 0 }],
      products: [product("p1")],
      ...NO_SCOPE,
    }).get("zone-A")!;

    expect(data.products.map((p) => p.id)).toEqual(["p1"]);
  });

  it("filters by scopedProductIds when isScoped is true", () => {
    const data = buildZoneInventoryMap({
      zones: [zoneA],
      zoneProductRows: [
        { zone_id: "zone-A", product_id: "p1" },
        { zone_id: "zone-A", product_id: "p2" },
      ],
      inventory: [
        { product_id: "p1", quantity: 4, min_stock: 0 },
        { product_id: "p2", quantity: 7, min_stock: 0 },
      ],
      products: [product("p1"), product("p2")],
      isScoped: true,
      scopedProductIds: new Set(["p1"]),
    }).get("zone-A")!;

    expect(data.products.map((p) => p.id)).toEqual(["p1"]);
    expect(data.totalQuantity).toBe(4);
  });

  it("does NOT filter by scopedProductIds when isScoped is false (even if the set is non-empty)", () => {
    const data = buildZoneInventoryMap({
      zones: [zoneA],
      zoneProductRows: [
        { zone_id: "zone-A", product_id: "p1" },
        { zone_id: "zone-A", product_id: "p2" },
      ],
      inventory: [],
      products: [product("p1"), product("p2")],
      isScoped: false,
      scopedProductIds: new Set(["p1"]), // ignored
    }).get("zone-A")!;

    expect(data.products.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("only includes products assigned to the given zone (not products from other zones)", () => {
    const map = buildZoneInventoryMap({
      zones: [zoneA, zoneB],
      zoneProductRows: [
        { zone_id: "zone-A", product_id: "p1" },
        { zone_id: "zone-B", product_id: "p2" },
      ],
      inventory: [
        { product_id: "p1", quantity: 1, min_stock: 0 },
        { product_id: "p2", quantity: 2, min_stock: 0 },
      ],
      products: [product("p1"), product("p2")],
      ...NO_SCOPE,
    });

    expect(map.get("zone-A")!.products.map((p) => p.id)).toEqual(["p1"]);
    expect(map.get("zone-B")!.products.map((p) => p.id)).toEqual(["p2"]);
  });
});
