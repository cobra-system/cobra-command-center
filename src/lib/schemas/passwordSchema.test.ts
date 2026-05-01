import { describe, it, expect } from "vitest";
import { passwordSchema, passwordChangeSchema } from "./passwordSchema";

describe("passwordSchema", () => {
  it("accepts a password meeting all rules", () => {
    expect(passwordSchema.safeParse("Password1!").success).toBe(true);
  });

  it("rejects passwords shorter than 10 characters", () => {
    const r = passwordSchema.safeParse("Pass1!");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("10");
    }
  });

  it("rejects passwords without an uppercase letter", () => {
    const r = passwordSchema.safeParse("password1!");
    expect(r.success).toBe(false);
  });

  it("rejects passwords without a lowercase letter", () => {
    const r = passwordSchema.safeParse("PASSWORD1!");
    expect(r.success).toBe(false);
  });

  it("rejects passwords without a digit", () => {
    const r = passwordSchema.safeParse("Password!!");
    expect(r.success).toBe(false);
  });

  it("rejects passwords without a special character", () => {
    const r = passwordSchema.safeParse("Password11");
    expect(r.success).toBe(false);
  });
});

describe("passwordChangeSchema", () => {
  it("accepts matching valid passwords", () => {
    const r = passwordChangeSchema.safeParse({
      newPassword: "Password1!",
      confirmPassword: "Password1!",
    });
    expect(r.success).toBe(true);
  });

  it("rejects mismatched confirmation", () => {
    const r = passwordChangeSchema.safeParse({
      newPassword: "Password1!",
      confirmPassword: "Password2!",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const mismatch = r.error.issues.find((i) => i.path.includes("confirmPassword"));
      expect(mismatch?.message).toBe("הסיסמאות אינן תואמות");
    }
  });

  it("rejects when newPassword fails validation even if both fields match", () => {
    const r = passwordChangeSchema.safeParse({
      newPassword: "weak",
      confirmPassword: "weak",
    });
    expect(r.success).toBe(false);
  });
});
