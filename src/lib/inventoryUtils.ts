/**
 * Shared helpers for updating center_inventory from equipment pickups/returns.
 * All changes target the main distribution center (is_main = true).
 */

import { supabase } from "@/lib/supabase";

interface InventoryItem {
  product_id: string;
  quantity: number;
}

/** Fetch the main center id (cached within the call chain). */
async function getMainCenterId(): Promise<string | null> {
  const { data } = await supabase
    .from("distribution_centers")
    .select("id")
    .eq("is_main", true)
    .limit(1)
    .single();
  return data?.id ?? null;
}

/**
 * Deduct quantities from the main center when equipment is picked up.
 * Logs each change to inventory_change_log.
 */
export async function deductInventoryForPickup(
  items: InventoryItem[],
  installerName: string,
  changedBy: string | null
) {
  const centerId = await getMainCenterId();
  if (!centerId) return;

  for (const item of items) {
    const { data: inv } = await supabase
      .from("center_inventory")
      .select("id, quantity")
      .eq("center_id", centerId)
      .eq("product_id", item.product_id)
      .maybeSingle();

    const oldQty = inv?.quantity ?? 0;
    const newQty = Math.max(0, oldQty - item.quantity);

    if (inv) {
      await supabase
        .from("center_inventory")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", inv.id);
    } else {
      await supabase.from("center_inventory").insert({
        center_id: centerId,
        product_id: item.product_id,
        quantity: 0,
      });
    }

    await supabase.from("inventory_change_log").insert({
      center_id: centerId,
      product_id: item.product_id,
      old_quantity: oldQty,
      new_quantity: newQty,
      change_type: "equipment_pickup",
      changed_by: changedBy,
      reason: `הצטיידות — ${installerName}`,
    });
  }
}

/**
 * Add quantities back to the main center when equipment is returned.
 * Logs each change to inventory_change_log.
 */
export async function restockInventoryForReturn(
  items: InventoryItem[],
  installerName: string,
  changedBy: string | null
) {
  const centerId = await getMainCenterId();
  if (!centerId) return;

  for (const item of items) {
    const { data: inv } = await supabase
      .from("center_inventory")
      .select("id, quantity")
      .eq("center_id", centerId)
      .eq("product_id", item.product_id)
      .maybeSingle();

    const oldQty = inv?.quantity ?? 0;
    const newQty = oldQty + item.quantity;

    if (inv) {
      await supabase
        .from("center_inventory")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", inv.id);
    } else {
      await supabase.from("center_inventory").insert({
        center_id: centerId,
        product_id: item.product_id,
        quantity: newQty,
      });
    }

    await supabase.from("inventory_change_log").insert({
      center_id: centerId,
      product_id: item.product_id,
      old_quantity: oldQty,
      new_quantity: newQty,
      change_type: "equipment_return",
      changed_by: changedBy,
      reason: `החזרה — ${installerName}`,
    });
  }
}

/**
 * When a return item is confirmed faulty (is_actually_faulty = true):
 * deduct 1 unit from main center_inventory and create a waste_item record.
 */
export async function markItemAsFaulty(opts: {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  returnItemId: string;
  changedBy: string | null;
  changedByName: string | null;
}) {
  const centerId = await getMainCenterId();
  if (centerId) {
    const { data: inv } = await supabase
      .from("center_inventory")
      .select("id, quantity")
      .eq("center_id", centerId)
      .eq("product_id", opts.productId)
      .maybeSingle();

    if (inv) {
      const newQty = Math.max(0, inv.quantity - opts.quantity);
      await supabase
        .from("center_inventory")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", inv.id);

      await supabase.from("inventory_change_log").insert({
        center_id: centerId,
        product_id: opts.productId,
        old_quantity: inv.quantity,
        new_quantity: newQty,
        change_type: "manual",
        changed_by: opts.changedByName,
        reason: "פריט שאושר כפגום — הועבר לניהול בלאי",
      });
    }
  }

  // Create waste_item record
  await supabase.from("waste_items").insert({
    product_name: opts.productName,
    sku: opts.sku ?? "",
    quantity: opts.quantity,
    in_use: false,
    recommendations: "",
    source: "equipment_return",
    return_item_id: opts.returnItemId,
    created_by: opts.changedBy,
    created_by_name: opts.changedByName,
  });
}

/**
 * Undo a faulty marking (restores inventory, deletes waste_item).
 */
export async function unmarkItemAsFaulty(opts: {
  productId: string;
  quantity: number;
  returnItemId: string;
  changedBy: string | null;
  changedByName: string | null;
}) {
  const centerId = await getMainCenterId();
  if (centerId) {
    const { data: inv } = await supabase
      .from("center_inventory")
      .select("id, quantity")
      .eq("center_id", centerId)
      .eq("product_id", opts.productId)
      .maybeSingle();

    if (inv) {
      const newQty = inv.quantity + opts.quantity;
      await supabase
        .from("center_inventory")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", inv.id);

      await supabase.from("inventory_change_log").insert({
        center_id: centerId,
        product_id: opts.productId,
        old_quantity: inv.quantity,
        new_quantity: newQty,
        change_type: "manual",
        changed_by: opts.changedByName,
        reason: "סימון פגם בוטל — הוחזר למלאי",
      });
    }
  }

  // Delete waste_item created from this return item
  await supabase
    .from("waste_items")
    .delete()
    .eq("return_item_id", opts.returnItemId)
    .eq("source", "equipment_return");
}
