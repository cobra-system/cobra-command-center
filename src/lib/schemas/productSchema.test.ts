import { describe, it, expect } from "vitest";
import { productSchema, productComponentSchema } from "./productSchema";

const validProduct = {
  name: "Pen",
  sku: "PEN-001",
};

describe("productSchema", () => {
  it("accepts a minimal valid product and applies defaults", () => {
    const r = productSchema.safeParse(validProduct);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.stock_qty).toBe(0);
      expect(r.data.incoming_qty).toBe(0);
    }
  });

  it("rejects empty name", () => {
    expect(productSchema.safeParse({ ...validProduct, name: "" }).success).toBe(false);
  });

  it("rejects empty sku", () => {
    expect(productSchema.safeParse({ ...validProduct, sku: "" }).success).toBe(false);
  });

  it("rejects negative stock_qty", () => {
    expect(productSchema.safeParse({ ...validProduct, stock_qty: -1 }).success).toBe(false);
  });

  it("rejects negative purchase_price", () => {
    expect(productSchema.safeParse({ ...validProduct, purchase_price: -1 }).success).toBe(false);
  });

  it("allows null purchase_price", () => {
    expect(productSchema.safeParse({ ...validProduct, purchase_price: null }).success).toBe(true);
  });

  it("rejects non-integer lead_time_days", () => {
    expect(productSchema.safeParse({ ...validProduct, lead_time_days: 1.5 }).success).toBe(false);
  });

  it("rejects lead_time_days below 1", () => {
    expect(productSchema.safeParse({ ...validProduct, lead_time_days: 0 }).success).toBe(false);
  });

  it("rejects lead_time_days above 365", () => {
    expect(productSchema.safeParse({ ...validProduct, lead_time_days: 366 }).success).toBe(false);
  });

  it("accepts lead_time_days at the boundaries", () => {
    expect(productSchema.safeParse({ ...validProduct, lead_time_days: 1 }).success).toBe(true);
    expect(productSchema.safeParse({ ...validProduct, lead_time_days: 365 }).success).toBe(true);
  });
});

describe("productComponentSchema", () => {
  it("accepts a minimal valid component", () => {
    expect(productComponentSchema.safeParse({ name: "Bolt" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(productComponentSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects negative stock_qty", () => {
    expect(productComponentSchema.safeParse({ name: "Bolt", stock_qty: -1 }).success).toBe(false);
  });
});
