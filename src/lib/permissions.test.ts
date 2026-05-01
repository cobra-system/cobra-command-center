import { describe, it, expect } from "vitest";
import {
  canView,
  canEdit,
  getModuleKeyFromRoute,
  getFullPermissionsForManager,
  isDivisionManagerAllowedPath,
  isDivisionManager,
  resolveCurrentUserPermissions,
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

describe("isDivisionManagerAllowedPath", () => {
  it("returns true for allowed prefixes (and their nested routes)", () => {
    expect(isDivisionManagerAllowedPath("/products")).toBe(true);
    expect(isDivisionManagerAllowedPath("/products/abc-123")).toBe(true);
    expect(isDivisionManagerAllowedPath("/orders")).toBe(true);
    expect(isDivisionManagerAllowedPath("/suppliers")).toBe(true);
    expect(isDivisionManagerAllowedPath("/waste-management")).toBe(true);
  });

  it("allows curated equipment subpaths but blocks the equipment root", () => {
    expect(isDivisionManagerAllowedPath("/equipment/division/d1")).toBe(true);
    expect(isDivisionManagerAllowedPath("/equipment/installer/i1")).toBe(true);
    expect(isDivisionManagerAllowedPath("/equipment")).toBe(false);
  });

  it("blocks paths outside the curated set", () => {
    expect(isDivisionManagerAllowedPath("/dashboard")).toBe(false);
    expect(isDivisionManagerAllowedPath("/tasks")).toBe(false);
    expect(isDivisionManagerAllowedPath("/team")).toBe(false);
    expect(isDivisionManagerAllowedPath("/")).toBe(false);
  });
});

describe("isDivisionManager", () => {
  it("returns false for null/undefined user", () => {
    expect(isDivisionManager(null)).toBe(false);
    expect(isDivisionManager(undefined)).toBe(false);
  });

  it("returns false for MANAGER role even with a division", () => {
    expect(isDivisionManager({ role: "MANAGER", division: "north" })).toBe(false);
  });

  it("returns false for non-MANAGER role without a division", () => {
    expect(isDivisionManager({ role: "EMPLOYEE", division: null })).toBe(false);
    expect(isDivisionManager({ role: "EMPLOYEE" })).toBe(false);
  });

  it("returns true for non-MANAGER role with a division", () => {
    expect(isDivisionManager({ role: "EMPLOYEE", division: "north" })).toBe(true);
  });
});

describe("resolveCurrentUserPermissions", () => {
  it("grants full permissions when there is no signed-in user", () => {
    const perms = resolveCurrentUserPermissions(null, [], []);
    expect(perms).toEqual(getFullPermissionsForManager());
  });

  it("grants full permissions to MANAGER even when role_definition_id is set", () => {
    const perms = resolveCurrentUserPermissions(
      { role: "MANAGER", role_definition_id: "rd-1" },
      [{ id: "rd-1", system_key: "RESTRICTED_ROLE" }],
      [{ role: "RESTRICTED_ROLE", module_key: "products", permission_level: "none" }],
    );
    expect(perms).toEqual(getFullPermissionsForManager());
  });

  it("looks up permissions by role_definition.system_key when present", () => {
    const perms = resolveCurrentUserPermissions(
      { role: "WAREHOUSE_MANAGER", role_definition_id: "rd-1" },
      [{ id: "rd-1", system_key: "logistics_lead" }],
      [
        { role: "logistics_lead", module_key: "products", permission_level: "edit" },
        { role: "logistics_lead", module_key: "orders", permission_level: "view" },
        // Decoy that should NOT win because its role doesn't match the system_key
        { role: "WAREHOUSE_MANAGER", module_key: "products", permission_level: "none" },
      ],
    );
    expect(perms.products).toBe("edit");
    expect(perms.orders).toBe("view");
  });

  it("falls back to role_definition.id (UUID) when system_key is null", () => {
    const perms = resolveCurrentUserPermissions(
      { role: "WAREHOUSE_MANAGER", role_definition_id: "rd-uuid" },
      [{ id: "rd-uuid", system_key: null }],
      [{ role: "rd-uuid", module_key: "products", permission_level: "view" }],
    );
    expect(perms.products).toBe("view");
  });

  it("falls back to currentUser.role when no role_definition_id is set", () => {
    const perms = resolveCurrentUserPermissions(
      { role: "DRIVER", role_definition_id: null },
      [],
      [{ role: "DRIVER", module_key: "orders", permission_level: "edit" }],
    );
    expect(perms.orders).toBe("edit");
  });

  it("falls back to currentUser.role when role_definition_id has no matching definition", () => {
    const perms = resolveCurrentUserPermissions(
      { role: "DRIVER", role_definition_id: "missing-id" },
      [{ id: "other", system_key: "other" }],
      [{ role: "DRIVER", module_key: "orders", permission_level: "view" }],
    );
    expect(perms.orders).toBe("view");
  });

  it("defaults missing permission rows to 'none' for every module", () => {
    const perms = resolveCurrentUserPermissions(
      { role: "DRIVER" },
      [],
      [{ role: "DRIVER", module_key: "orders", permission_level: "edit" }],
    );
    expect(perms.orders).toBe("edit");
    for (const mod of MODULES) {
      if (mod.key === "orders") continue;
      expect(perms[mod.key]).toBe("none");
    }
  });
});
