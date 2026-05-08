import { supabase } from "@/lib/supabase";
import type { OrderRequest } from "@/contexts/types";

/**
 * "Live" division stock per (division, product). Sourced from division_products,
 * which is the single source of truth.
 */
export type DivisionStockMap = Map<string, number | null>;

const stockKey = (division: string, productId: string) => `${division}::${productId}`;

export async function fetchDivisionStockMap(divisionFilter?: string): Promise<DivisionStockMap> {
  let q = supabase.from("division_products").select("division, product_id, division_stock");
  if (divisionFilter) q = q.eq("division", divisionFilter);
  const { data, error } = await q;
  const map: DivisionStockMap = new Map();
  if (error) return map;
  for (const r of (data ?? []) as { division: string; product_id: string; division_stock: number | null }[]) {
    map.set(stockKey(r.division, r.product_id), r.division_stock);
  }
  return map;
}

/** Hydrate every request's division_stock from the lookup map (in place). */
export function hydrateDivisionStock<T extends Pick<OrderRequest, "division" | "product_id"> & { division_stock?: number | null }>(
  requests: T[],
  map: DivisionStockMap,
): T[] {
  return requests.map(r => {
    if (!r.product_id) return r;
    const live = map.get(stockKey(r.division, r.product_id));
    if (live === undefined) return r;
    return { ...r, division_stock: live };
  });
}

/**
 * Write the new stock to division_products (upsert). This is the only path that
 * touches "current stock" — order_requests no longer carries the column.
 */
export async function updateDivisionStock(
  division: string,
  productId: string,
  newValue: number | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!productId) return { ok: false, error: "אי אפשר לעדכן מלאי לשורת תכנון ללא מוצר משויך" };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("division_products")
    .upsert(
      { division, product_id: productId, division_stock: newValue, division_stock_updated_at: now },
      { onConflict: "division,product_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
