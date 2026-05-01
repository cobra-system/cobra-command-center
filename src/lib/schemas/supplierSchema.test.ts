import { describe, it, expect } from "vitest";
import { supplierSchema, supplierContactSchema } from "./supplierSchema";

const validSupplier = {
  company: "Acme",
  contact_name: "Wile E. Coyote",
};

describe("supplierSchema", () => {
  it("accepts a minimal valid supplier", () => {
    expect(supplierSchema.safeParse(validSupplier).success).toBe(true);
  });

  it("rejects empty company", () => {
    expect(supplierSchema.safeParse({ ...validSupplier, company: "" }).success).toBe(false);
  });

  it("rejects empty contact_name", () => {
    expect(supplierSchema.safeParse({ ...validSupplier, contact_name: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      supplierSchema.safeParse({ ...validSupplier, email: "not-an-email" }).success
    ).toBe(false);
  });

  it("accepts a valid email", () => {
    expect(
      supplierSchema.safeParse({ ...validSupplier, email: "buyer@acme.com" }).success
    ).toBe(true);
  });

  it("allows null email", () => {
    expect(
      supplierSchema.safeParse({ ...validSupplier, email: null }).success
    ).toBe(true);
  });
});

describe("supplierContactSchema", () => {
  it("accepts a minimal valid contact", () => {
    expect(supplierContactSchema.safeParse({ name: "Roadrunner" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(supplierContactSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      supplierContactSchema.safeParse({ name: "X", email: "bad" }).success
    ).toBe(false);
  });
});
