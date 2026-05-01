import type { WarehouseZone } from "@/data/warehouseZones";
import type { Product } from "@/contexts/types";

export interface ZoneProduct {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  minStock: number;
  isLowStock: boolean;
  stockQty: number;
  incomingQty: number;
}

export interface ZoneInventoryData {
  zone: WarehouseZone;
  products: ZoneProduct[];
  totalQuantity: number;
  hasLowStock: boolean;
}

export interface ZoneProductRow {
  zone_id: string;
  product_id: string;
}

export interface CenterInventoryRow {
  product_id: string;
  quantity: number;
  min_stock: number;
}

/**
 * Joins zones with their assigned products and the per-product center inventory
 * to build the per-zone summary used by the warehouse map. When `isScoped` is
 * true, only products in `scopedProductIds` are included.
 *
 * `isLowStock` requires both a positive `min_stock` AND `quantity < min_stock`
 * so zero-min-stock entries (the default) are never flagged as low-stock.
 */
export function buildZoneInventoryMap(args: {
  zones: WarehouseZone[];
  zoneProductRows: ZoneProductRow[];
  inventory: CenterInventoryRow[];
  products: Product[];
  isScoped: boolean;
  scopedProductIds: Set<string>;
}): Map<string, ZoneInventoryData> {
  const { zones, zoneProductRows, inventory, products, isScoped, scopedProductIds } = args;

  const productMap = new Map<string, Product>();
  for (const p of products) productMap.set(p.id, p);

  const inventoryMap = new Map<string, CenterInventoryRow>();
  for (const row of inventory) inventoryMap.set(row.product_id, row);

  const result = new Map<string, ZoneInventoryData>();

  for (const zone of zones) {
    const assignedProductIds = zoneProductRows
      .filter((r) => r.zone_id === zone.id)
      .map((r) => r.product_id);

    const zoneProducts: ZoneProduct[] = [];
    for (const pid of assignedProductIds) {
      const product = productMap.get(pid);
      if (!product) continue;
      if (isScoped && !scopedProductIds.has(pid)) continue;

      const inv = inventoryMap.get(pid);
      const quantity = inv?.quantity ?? 0;
      const minStock = inv?.min_stock ?? 0;

      zoneProducts.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        quantity,
        minStock,
        isLowStock: minStock > 0 && quantity < minStock,
        stockQty: product.stock_qty,
        incomingQty: product.incoming_qty,
      });
    }

    result.set(zone.id, {
      zone,
      products: zoneProducts,
      totalQuantity: zoneProducts.reduce((sum, p) => sum + p.quantity, 0),
      hasLowStock: zoneProducts.some((p) => p.isLowStock),
    });
  }

  return result;
}
