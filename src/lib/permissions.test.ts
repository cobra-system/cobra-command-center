import { describe, it, expect } from "vitest";
import {
  canView,
  canEdit,
  getModuleKeyFromRoute,
  getFullPermissionsForManager,
  isDivisionManager,
  isDivisionManagerAllowedPath,
  canSeePrices,
  canSeeDocuments,
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

// ─── Money / documents access checks ────────────────────────────────────────
// These guard the entire "hide money/documents from non-MANAGER" effort.
// Any change to these helpers must be a deliberate security decision.

describe("canSeePrices", () => {
  it("returns true ONLY for MANAGER", () => {
    expect(canSeePrices({ role: "MANAGER" })).toBe(true);
  });

  it("returns false for every other role", () => {
    expect(canSeePrices({ role: "WAREHOUSE_MANAGER" })).toBe(false);
    expect(canSeePrices({ role: "LOGISTICS" })).toBe(false);
    expect(canSeePrices({ role: "DRIVER" })).toBe(false);
    expect(canSeePrices({ role: "DIVISION" })).toBe(false);
    expect(canSeePrices({ role: "" })).toBe(false);
    expect(canSeePrices({ role: "manager" })).toBe(false); // case-sensitive
  });

  it("returns false for null/undefined user", () => {
    expect(canSeePrices(null)).toBe(false);
    expect(canSeePrices(undefined)).toBe(false);
  });
});

describe("canSeeDocuments", () => {
  it("returns true ONLY for MANAGER", () => {
    expect(canSeeDocuments({ role: "MANAGER" })).toBe(true);
  });

  it("returns false for every other role", () => {
    expect(canSeeDocuments({ role: "WAREHOUSE_MANAGER" })).toBe(false);
    expect(canSeeDocuments({ role: "LOGISTICS" })).toBe(false);
    expect(canSeeDocuments({ role: "DRIVER" })).toBe(false);
    expect(canSeeDocuments({ role: "DIVISION" })).toBe(false);
  });

  it("returns false for null/undefined user", () => {
    expect(canSeeDocuments(null)).toBe(false);
    expect(canSeeDocuments(undefined)).toBe(false);
  });
});

describe("isDivisionManager", () => {
  it("requires non-MANAGER role and a division", () => {
    expect(isDivisionManager({ role: "DIVISION", division: "פריזבי קרסו" })).toBe(true);
    expect(isDivisionManager({ role: "MANAGER", division: "פריזבי קרסו" })).toBe(false);
    expect(isDivisionManager({ role: "DIVISION", division: null })).toBe(false);
    expect(isDivisionManager({ role: "DIVISION" })).toBe(false);
    expect(isDivisionManager({ role: "DIVISION", division: "" })).toBe(false);
  });

  it("returns false for null/undefined user", () => {
    expect(isDivisionManager(null)).toBe(false);
    expect(isDivisionManager(undefined)).toBe(false);
  });
});

describe("isDivisionManagerAllowedPath", () => {
  it("allows products, orders, suppliers, waste, equipment routes", () => {
    expect(isDivisionManagerAllowedPath("/products")).toBe(true);
    expect(isDivisionManagerAllowedPath("/products/abc-123")).toBe(true);
    expect(isDivisionManagerAllowedPath("/orders")).toBe(true);
    expect(isDivisionManagerAllowedPath("/suppliers/x")).toBe(true);
    expect(isDivisionManagerAllowedPath("/waste-management")).toBe(true);
    expect(isDivisionManagerAllowedPath("/equipment/division/X")).toBe(true);
    expect(isDivisionManagerAllowedPath("/equipment/installer/x")).toBe(true);
  });

  it("blocks money/document/admin routes", () => {
    expect(isDivisionManagerAllowedPath("/dashboard")).toBe(false);
    expect(isDivisionManagerAllowedPath("/documents")).toBe(false);
    expect(isDivisionManagerAllowedPath("/documents/x")).toBe(false);
    expect(isDivisionManagerAllowedPath("/reports")).toBe(false);
    expect(isDivisionManagerAllowedPath("/settings")).toBe(false);
    expect(isDivisionManagerAllowedPath("/issues")).toBe(false);
    expect(isDivisionManagerAllowedPath("/tasks")).toBe(false);
    expect(isDivisionManagerAllowedPath("/reorder")).toBe(false);
    expect(isDivisionManagerAllowedPath("/logistics-map")).toBe(false);
    expect(isDivisionManagerAllowedPath("/lock-control")).toBe(false);
    expect(isDivisionManagerAllowedPath("/equipment")).toBe(false); // bare /equipment is blocked
  });
});

describe("canSeePrices vs canSeeDocuments contract", () => {
  it("returns identical results for the same user (kept symmetric on purpose)", () => {
    const samples = [
      { role: "MANAGER" },
      { role: "WAREHOUSE_MANAGER" },
      { role: "DIVISION" },
      { role: "" },
      null,
      undefined,
    ] as const;
    for (const u of samples) {
      expect(canSeePrices(u)).toBe(canSeeDocuments(u));
    }
  });
});
