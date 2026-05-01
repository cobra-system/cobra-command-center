import { describe, it, expect } from "vitest";
import { employeeCreateSchema, employeeUpdateSchema } from "./employeeSchema";

describe("employeeCreateSchema", () => {
  const valid = {
    name: "Alice",
    email: "alice@example.com",
    password: "Password1!",
  };

  it("accepts a valid payload", () => {
    expect(employeeCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(employeeCreateSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(employeeCreateSchema.safeParse({ ...valid, email: "no" }).success).toBe(false);
  });

  it("rejects a weak password", () => {
    expect(employeeCreateSchema.safeParse({ ...valid, password: "weak" }).success).toBe(false);
  });
});

describe("employeeUpdateSchema", () => {
  it("accepts an empty password (means: leave unchanged)", () => {
    const r = employeeUpdateSchema.safeParse({ name: "Alice", password: "" });
    expect(r.success).toBe(true);
  });

  it("accepts a valid new password", () => {
    const r = employeeUpdateSchema.safeParse({ name: "Alice", password: "Password1!" });
    expect(r.success).toBe(true);
  });

  it("rejects a non-empty password that fails complexity rules", () => {
    const r = employeeUpdateSchema.safeParse({ name: "Alice", password: "weak" });
    expect(r.success).toBe(false);
  });

  it("rejects a non-empty password missing a special character", () => {
    const r = employeeUpdateSchema.safeParse({ name: "Alice", password: "Password11" });
    expect(r.success).toBe(false);
  });

  it("rejects empty name", () => {
    const r = employeeUpdateSchema.safeParse({ name: "", password: "" });
    expect(r.success).toBe(false);
  });
});
