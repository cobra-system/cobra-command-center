import { describe, it, expect, beforeEach, vi } from "vitest";

type Eq = [string, unknown];
type Write =
  | { kind: "update"; table: string; payload: Record<string, unknown>; eqs: Eq[] }
  | { kind: "insert"; table: string; payload: Record<string, unknown> }
  | { kind: "delete"; table: string; eqs: Eq[] };

const state = vi.hoisted(() => ({
  writes: [] as Write[],
  responses: [] as Array<{ data: unknown }>,
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    let mode: "select" | "update" | "insert" | "delete" | null = null;
    let payload: Record<string, unknown> | undefined;
    const eqs: Eq[] = [];

    const finalize = () => {
      if (mode === "update") state.writes.push({ kind: "update", table, payload: payload!, eqs });
      else if (mode === "insert") state.writes.push({ kind: "insert", table, payload: payload! });
      else if (mode === "delete") state.writes.push({ kind: "delete", table, eqs });
      return Promise.resolve({ data: null, error: null });
    };

    const b: Record<string, unknown> = {
      select: () => { mode = "select"; return b; },
      update: (p: Record<string, unknown>) => { mode = "update"; payload = p; return b; },
      insert: (p: Record<string, unknown>) => { mode = "insert"; payload = p; return b; },
      delete: () => { mode = "delete"; return b; },
      eq: (col: string, val: unknown) => { eqs.push([col, val]); return b; },
      limit: () => b,
      single: () =>
        Promise.resolve({ data: state.responses.shift()?.data ?? null, error: null }),
      maybeSingle: () =>
        Promise.resolve({ data: state.responses.shift()?.data ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        finalize().then(resolve, reject),
    };
    return b;
  }

  return { supabase: { from: builder } };
});

import {
  deductInventoryForPickup,
  restockInventoryForReturn,
  markItemAsFaulty,
  unmarkItemAsFaulty,
} from "./inventoryUtils";

const CENTER = { data: { id: "center-1" } };

beforeEach(() => {
  state.writes.length = 0;
  state.responses.length = 0;
});

function inserts(table: string) {
  return state.writes.filter((w): w is Extract<Write, { kind: "insert" }> =>
    w.kind === "insert" && w.table === table
  );
}
function updates(table: string) {
  return state.writes.filter((w): w is Extract<Write, { kind: "update" }> =>
    w.kind === "update" && w.table === table
  );
}
function deletes(table: string) {
  return state.writes.filter((w): w is Extract<Write, { kind: "delete" }> =>
    w.kind === "delete" && w.table === table
  );
}

describe("deductInventoryForPickup", () => {
  it("decrements existing inventory and logs the change", async () => {
    state.responses.push(CENTER, { data: { id: "inv-1", quantity: 10 } });

    await deductInventoryForPickup(
      [{ product_id: "p1", quantity: 3 }],
      "Alice",
      "user-1"
    );

    const upd = updates("center_inventory");
    expect(upd).toHaveLength(1);
    expect(upd[0].payload.quantity).toBe(7);
    expect(upd[0].eqs).toContainEqual(["id", "inv-1"]);

    const log = inserts("inventory_change_log");
    expect(log).toHaveLength(1);
    expect(log[0].payload).toMatchObject({
      product_id: "p1",
      old_quantity: 10,
      new_quantity: 7,
      change_type: "equipment_pickup",
      changed_by: "user-1",
    });
    expect(log[0].payload.reason).toContain("Alice");
  });

  it("clamps newQty at 0 when deducting more than is in stock", async () => {
    state.responses.push(CENTER, { data: { id: "inv-1", quantity: 2 } });

    await deductInventoryForPickup(
      [{ product_id: "p1", quantity: 5 }],
      "Alice",
      null
    );

    expect(updates("center_inventory")[0].payload.quantity).toBe(0);
    expect(inserts("inventory_change_log")[0].payload).toMatchObject({
      old_quantity: 2,
      new_quantity: 0,
    });
  });

  it("inserts a zero-quantity row and logs when no inventory row exists yet", async () => {
    state.responses.push(CENTER, { data: null });

    await deductInventoryForPickup(
      [{ product_id: "p1", quantity: 3 }],
      "Alice",
      "user-1"
    );

    expect(updates("center_inventory")).toHaveLength(0);
    const ins = inserts("center_inventory");
    expect(ins).toHaveLength(1);
    expect(ins[0].payload).toMatchObject({
      center_id: "center-1",
      product_id: "p1",
      quantity: 0,
    });
    expect(inserts("inventory_change_log")[0].payload).toMatchObject({
      old_quantity: 0,
      new_quantity: 0,
    });
  });

  it("returns silently when no main center is found (no writes)", async () => {
    state.responses.push({ data: null });

    await deductInventoryForPickup(
      [{ product_id: "p1", quantity: 1 }],
      "Alice",
      null
    );

    expect(state.writes).toHaveLength(0);
  });

  it("processes each item independently", async () => {
    state.responses.push(
      CENTER,
      { data: { id: "inv-a", quantity: 10 } },
      { data: { id: "inv-b", quantity: 5 } }
    );

    await deductInventoryForPickup(
      [
        { product_id: "pa", quantity: 1 },
        { product_id: "pb", quantity: 2 },
      ],
      "Alice",
      "user-1"
    );

    const upd = updates("center_inventory");
    expect(upd).toHaveLength(2);
    expect(upd[0].payload.quantity).toBe(9);
    expect(upd[1].payload.quantity).toBe(3);
    expect(inserts("inventory_change_log")).toHaveLength(2);
  });
});

describe("restockInventoryForReturn", () => {
  it("adds quantities back and logs the change", async () => {
    state.responses.push(CENTER, { data: { id: "inv-1", quantity: 4 } });

    await restockInventoryForReturn(
      [{ product_id: "p1", quantity: 3 }],
      "Bob",
      "user-2"
    );

    expect(updates("center_inventory")[0].payload.quantity).toBe(7);
    expect(inserts("inventory_change_log")[0].payload).toMatchObject({
      old_quantity: 4,
      new_quantity: 7,
      change_type: "equipment_return",
    });
  });

  it("creates the inventory row at the returned quantity when none exists", async () => {
    state.responses.push(CENTER, { data: null });

    await restockInventoryForReturn(
      [{ product_id: "p1", quantity: 5 }],
      "Bob",
      null
    );

    const ins = inserts("center_inventory");
    expect(ins).toHaveLength(1);
    expect(ins[0].payload.quantity).toBe(5);
    expect(inserts("inventory_change_log")[0].payload).toMatchObject({
      old_quantity: 0,
      new_quantity: 5,
    });
  });

  it("returns silently when no main center is found", async () => {
    state.responses.push({ data: null });

    await restockInventoryForReturn(
      [{ product_id: "p1", quantity: 1 }],
      "Bob",
      null
    );

    expect(state.writes).toHaveLength(0);
  });
});

describe("markItemAsFaulty", () => {
  it("deducts inventory, logs the change, and creates a waste_item", async () => {
    state.responses.push(CENTER, { data: { id: "inv-1", quantity: 10 } });

    await markItemAsFaulty({
      productId: "p1",
      productName: "Widget",
      sku: "W-1",
      quantity: 2,
      returnItemId: "ret-1",
      changedBy: "user-1",
      changedByName: "Alice",
    });

    expect(updates("center_inventory")[0].payload.quantity).toBe(8);
    expect(inserts("inventory_change_log")[0].payload).toMatchObject({
      old_quantity: 10,
      new_quantity: 8,
      change_type: "manual",
      changed_by: "Alice",
    });

    const waste = inserts("waste_items");
    expect(waste).toHaveLength(1);
    expect(waste[0].payload).toMatchObject({
      product_id: "p1",
      product_name: "Widget",
      sku: "W-1",
      quantity: 2,
      source: "equipment_return",
      return_item_id: "ret-1",
      created_by: "user-1",
      created_by_name: "Alice",
    });
  });

  it("clamps inventory at 0 when faulty quantity exceeds stock", async () => {
    state.responses.push(CENTER, { data: { id: "inv-1", quantity: 1 } });

    await markItemAsFaulty({
      productId: "p1",
      productName: "Widget",
      sku: "W-1",
      quantity: 5,
      returnItemId: "ret-1",
      changedBy: null,
      changedByName: null,
    });

    expect(updates("center_inventory")[0].payload.quantity).toBe(0);
  });

  it("normalises a null sku to empty string in the waste_item", async () => {
    state.responses.push(CENTER, { data: { id: "inv-1", quantity: 1 } });

    await markItemAsFaulty({
      productId: "p1",
      productName: "Widget",
      sku: null,
      quantity: 1,
      returnItemId: "ret-1",
      changedBy: null,
      changedByName: null,
    });

    expect(inserts("waste_items")[0].payload.sku).toBe("");
  });

  it("creates a waste_item but skips inventory work when inventory row is absent", async () => {
    state.responses.push(CENTER, { data: null });

    await markItemAsFaulty({
      productId: "p1",
      productName: "Widget",
      sku: "W-1",
      quantity: 2,
      returnItemId: "ret-1",
      changedBy: null,
      changedByName: null,
    });

    expect(updates("center_inventory")).toHaveLength(0);
    expect(inserts("inventory_change_log")).toHaveLength(0);
    expect(inserts("waste_items")).toHaveLength(1);
  });

  it("still creates a waste_item when no main center is found", async () => {
    state.responses.push({ data: null });

    await markItemAsFaulty({
      productId: "p1",
      productName: "Widget",
      sku: "W-1",
      quantity: 2,
      returnItemId: "ret-1",
      changedBy: null,
      changedByName: null,
    });

    expect(inserts("waste_items")).toHaveLength(1);
    expect(updates("center_inventory")).toHaveLength(0);
  });
});

describe("unmarkItemAsFaulty", () => {
  it("restores inventory, logs the change, and deletes the waste_item", async () => {
    state.responses.push(CENTER, { data: { id: "inv-1", quantity: 8 } });

    await unmarkItemAsFaulty({
      productId: "p1",
      quantity: 2,
      returnItemId: "ret-1",
      changedBy: "user-1",
      changedByName: "Alice",
    });

    expect(updates("center_inventory")[0].payload.quantity).toBe(10);
    expect(inserts("inventory_change_log")[0].payload).toMatchObject({
      old_quantity: 8,
      new_quantity: 10,
      change_type: "manual",
    });

    const del = deletes("waste_items");
    expect(del).toHaveLength(1);
    expect(del[0].eqs).toContainEqual(["return_item_id", "ret-1"]);
    expect(del[0].eqs).toContainEqual(["source", "equipment_return"]);
  });

  it("still deletes the waste_item when inventory row is absent", async () => {
    state.responses.push(CENTER, { data: null });

    await unmarkItemAsFaulty({
      productId: "p1",
      quantity: 2,
      returnItemId: "ret-1",
      changedBy: null,
      changedByName: null,
    });

    expect(updates("center_inventory")).toHaveLength(0);
    expect(inserts("inventory_change_log")).toHaveLength(0);
    expect(deletes("waste_items")).toHaveLength(1);
  });

  it("still deletes the waste_item when no main center is found", async () => {
    state.responses.push({ data: null });

    await unmarkItemAsFaulty({
      productId: "p1",
      quantity: 2,
      returnItemId: "ret-1",
      changedBy: null,
      changedByName: null,
    });

    expect(deletes("waste_items")).toHaveLength(1);
  });
});
