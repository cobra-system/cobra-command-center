import { useState, useEffect, useCallback } from "react";
import { useData } from "@/contexts/AppContext";
import { useProductScope } from "@/hooks/useProductScope";
import { supabase } from "@/lib/supabase";
import type { WarehouseZone, ZoneType } from "@/data/warehouseZones";
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

interface ZoneProductRow {
  zone_id: string;
  product_id: string;
}

interface CenterInventoryRow {
  product_id: string;
  quantity: number;
  min_stock: number;
}

interface WarehouseZoneRow {
  id: string;
  name: string;
  color: string;
  text_color: string;
  grid_row: string;
  grid_col: string;
  zone_type: string;
  icon: string | null;
  is_non_product: boolean;
  sort_order: number;
  capacity: number | null;
  notes: string | null;
}

export function useWarehouseInventory() {
  const { products: allProducts } = useData();
  const { scopedProducts, isScoped, scopedProductIds } = useProductScope();
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [zoneProductRows, setZoneProductRows] = useState<ZoneProductRow[]>([]);
  const [inventory, setInventory] = useState<CenterInventoryRow[]>([]);
  const [mainCenterId, setMainCenterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const products = isScoped ? scopedProducts : allProducts;
  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.id, p);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [centerRes, invRes, zpRes, zonesRes] = await Promise.all([
      supabase
        .from("distribution_centers")
        .select("id")
        .eq("is_main", true)
        .limit(1)
        .single(),
      supabase.from("center_inventory").select("product_id, quantity, min_stock"),
      supabase.from("warehouse_zone_products").select("zone_id, product_id"),
      supabase.from("warehouse_zones").select("*").order("sort_order"),
    ]);

    const centerId = centerRes.data?.id ?? null;
    setMainCenterId(centerId);

    if (zonesRes.data) {
      setZones(
        (zonesRes.data as WarehouseZoneRow[]).map((row) => ({
          id: row.id,
          name: row.name,
          color: row.color,
          textColor: row.text_color,
          gridRow: row.grid_row,
          gridColumn: row.grid_col,
          zoneType: row.zone_type as ZoneType,
          icon: row.icon ?? undefined,
          isNonProduct: row.is_non_product,
          capacity: row.capacity ?? undefined,
          notes: row.notes ?? undefined,
        })),
      );
    }

    if (invRes.data) {
      if (centerId) {
        const { data: mainInv } = await supabase
          .from("center_inventory")
          .select("product_id, quantity, min_stock")
          .eq("center_id", centerId);
        setInventory((mainInv ?? []) as CenterInventoryRow[]);
      } else {
        setInventory([]);
      }
    }

    if (zpRes.data) {
      setZoneProductRows(zpRes.data as ZoneProductRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build the zone inventory map
  const inventoryMap = new Map<string, CenterInventoryRow>();
  for (const row of inventory) {
    inventoryMap.set(row.product_id, row);
  }

  const zoneInventoryMap = new Map<string, ZoneInventoryData>();

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

    zoneInventoryMap.set(zone.id, {
      zone,
      products: zoneProducts,
      totalQuantity: zoneProducts.reduce((sum, p) => sum + p.quantity, 0),
      hasLowStock: zoneProducts.some((p) => p.isLowStock),
    });
  }

  return {
    zones,
    zoneInventoryMap,
    allProducts: products,
    mainCenterId,
    loading,
    refetch: fetchData,
  };
}
