import { describe, it, expect } from "vitest";
import {
  canView,
  canEdit,
  getModuleKeyFromRoute,
  getFullPermissionsForManager,
  MODULES,
  type RolePermissions,
} from "./permissions";

describe("canView", () => {
  it("returns true for 'view' permission", () => {
    const perms: RolePermissions = { products: "view" };
    expect(canView(perms, "products")).toBe(true);
  });

  it("returns true for 'edit' permission", () => {
    const perms: RolePermissions = { products: "edit" };
    expect(canView(perms, "products")).toBe(true);
  });

  it("returns false for 'none' permission", () => {
    const perms: RolePermissions = { products: "none" };
    expect(canView(perms, "products")).toBe(false);
  });

  it("returns false for missing module key", () => {
    const perms: RolePermissions = {};
    expect(canView(perms, "products")).toBe(false);
  });
});

describe("canEdit", () => {
  it("returns true for 'edit' permission", () => {
    const perms: RolePermissions = { orders: "edit" };
    expect(canEdit(perms, "orders")).toBe(true);
  });

  it("returns false for 'view' permission", () => {
    const perms: RolePermissions = { orders: "view" };
    expect(canEdit(perms, "orders")).toBe(false);
  });

  it("returns false for 'none' permission", () => {
    const perms: RolePermissions = { orders: "none" };
    expect(canEdit(perms, "orders")).toBe(false);
  });

  it("returns false for missing module key", () => {
    expect(canEdit({}, "orders")).toBe(false);
  });
});

describe("getModuleKeyFromRoute", () => {
  it("maps simple routes to module keys", () => {
    expect(getModuleKeyFromRoute("/products")).toBe("products");
    expect(getModuleKeyFromRoute("/orders")).toBe("orders");
    expect(getModuleKeyFromRoute("/tasks")).toBe("tasks");
    expect(getModuleKeyFromRoute("/dashboard")).toBe("dashboard");
  });

  it("extracts base path from nested routes", () => {
    expect(getModuleKeyFromRoute("/products/123")).toBe("products");
    expect(getModuleKeyFromRoute("/orders/abc/edit")).toBe("orders");
  });

  it("handles waste-management route", () => {
    expect(getModuleKeyFromRoute("/waste-management")).toBe("waste");
  });

  it("returns null for unknown routes", () => {
    expect(getModuleKeyFromRoute("/unknown")).toBeNull();
    expect(getModuleKeyFromRoute("/")).toBeNull();
  });
});

describe("getFullPermissionsForManager", () => {
  it("returns edit permission for all modules", () => {
    const perms = getFullPermissionsForManager();
    for (const mod of MODULES) {
      expect(perms[mod.key]).toBe("edit");
    }
  });

  it("includes all module keys", () => {
    const perms = getFullPermissionsForManager();
    expect(Object.keys(perms)).toHaveLength(MODULES.length);
  });
});

describe("MODULES", () => {
  it("has entries with key, label, and route", () => {
    for (const mod of MODULES) {
      expect(mod.key).toBeTruthy();
      expect(mod.label).toBeTruthy();
      expect(mod.route).toMatch(/^\//);
    }
  });
});
