import { describe, it, expect } from "vitest";
import { orderSchema, orderItemSchema, ORDER_STATUSES } from "./orderSchema";

const validItem = {
  name: "Widget",
  qty: 1,
  unit_price: 10,
};

const validOrder = {
  supplier_id: "supplier-1",
  priority: "בינוני" as const,
  items: [validItem],
};

describe("orderItemSchema", () => {
  it("accepts a minimal valid item", () => {
    expect(orderItemSchema.safeParse({ name: "x", qty: 1 }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(orderItemSchema.safeParse({ name: "", qty: 1 }).success).toBe(false);
  });

  it("rejects qty below 1", () => {
    expect(orderItemSchema.safeParse({ name: "x", qty: 0 }).success).toBe(false);
  });

  it("rejects non-integer qty", () => {
    expect(orderItemSchema.safeParse({ name: "x", qty: 1.5 }).success).toBe(false);
  });

  it("rejects negative unit_price", () => {
    expect(
      orderItemSchema.safeParse({ name: "x", qty: 1, unit_price: -1 }).success
    ).toBe(false);
  });

  it("allows null unit_price", () => {
    expect(
      orderItemSchema.safeParse({ name: "x", qty: 1, unit_price: null }).success
    ).toBe(true);
  });
});

describe("orderSchema", () => {
  it("accepts a valid order", () => {
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("defaults priority to בינוני when omitted", () => {
    const r = orderSchema.safeParse({ ...validOrder, priority: undefined });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.priority).toBe("בינוני");
  });

  it("rejects missing supplier_id", () => {
    expect(orderSchema.safeParse({ ...validOrder, supplier_id: "" }).success).toBe(false);
  });

  it("rejects an empty items array", () => {
    expect(orderSchema.safeParse({ ...validOrder, items: [] }).success).toBe(false);
  });

  it("rejects an invalid priority", () => {
    expect(
      orderSchema.safeParse({ ...validOrder, priority: "סופר דחוף" as never }).success
    ).toBe(false);
  });

  it("rejects a non-uuid shipment_group_id", () => {
    expect(
      orderSchema.safeParse({ ...validOrder, shipment_group_id: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("accepts a uuid shipment_group_id", () => {
    expect(
      orderSchema.safeParse({
        ...validOrder,
        shipment_group_id: "11111111-1111-1111-1111-111111111111",
      }).success
    ).toBe(true);
  });
});

describe("ORDER_STATUSES", () => {
  it("contains the expected status values", () => {
    expect(ORDER_STATUSES).toContain("PENDING");
    expect(ORDER_STATUSES).toContain("DELIVERED");
    expect(ORDER_STATUSES).toContain("CANCELLED");
  });
});
