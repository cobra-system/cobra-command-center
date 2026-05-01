import { useState, useEffect, useCallback, useMemo } from "react";
import { useData } from "@/contexts/AppContext";
import { useProductScope } from "@/hooks/useProductScope";
import { supabase } from "@/lib/supabase";
import type { WarehouseZone, ZoneType } from "@/data/warehouseZones";
import {
  buildZoneInventoryMap,
  type ZoneInventoryData,
  type ZoneProduct,
  type ZoneProductRow,
  type CenterInventoryRow,
} from "@/lib/warehouseInventoryUtils";

export type { ZoneInventoryData, ZoneProduct };

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

  const zoneInventoryMap = useMemo(
    () =>
      buildZoneInventoryMap({
        zones,
        zoneProductRows,
        inventory,
        products,
        isScoped,
        scopedProductIds,
      }),
    [zones, zoneProductRows, inventory, products, isScoped, scopedProductIds],
  );

  return {
    zones,
    zoneInventoryMap,
    allProducts: products,
    mainCenterId,
    loading,
    refetch: fetchData,
  };
}
