import { supabase } from "@/lib/supabase";

/**
 * Syncs the `division_products` rows for a product against the comma-separated
 * list of divisions stored on `products.division`. The DB trigger
 * `division_products → products.division` keeps the canonical column in sync,
 * so callers only need to call this after writing the new division string.
 */
export async function syncDivisionProducts(
  productId: string,
  newDivision: string | null | undefined,
): Promise<void> {
  const newDivs = new Set(
    (newDivision || "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
  );

  const { data: current } = await supabase
    .from("division_products")
    .select("id, division")
    .eq("product_id", productId);

  const existing = current || [];
  const existingDivs = new Set(existing.map((dp) => dp.division));

  const toDelete = existing.filter((dp) => !newDivs.has(dp.division));
  if (toDelete.length > 0) {
    await supabase
      .from("division_products")
      .delete()
      .in("id", toDelete.map((dp) => dp.id));
  }

  const toInsert = [...newDivs].filter((d) => !existingDivs.has(d));
  if (toInsert.length > 0) {
    await supabase
      .from("division_products")
      .insert(toInsert.map((d) => ({ division: d, product_id: productId })));
  }
}
