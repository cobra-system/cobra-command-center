export type PermissionLevel = "none" | "view" | "edit";
export type RolePermissions = Record<string, PermissionLevel>;

export interface ModuleDefinition {
  key: string;
  label: string;
  route: string;
  category: "Core" | "Tasks" | "Documents" | "Warehouse";
}

export const MODULES: ModuleDefinition[] = [
  { key: "dashboard", label: "דשבורד", route: "/dashboard", category: "Core" },
  { key: "products", label: "מוצרים", route: "/products", category: "Core" },
  { key: "orders", label: "הזמנות", route: "/orders", category: "Core" },
  { key: "inventory", label: "מלאי", route: "/inventory", category: "Core" },
  { key: "suppliers", label: "ספקים", route: "/suppliers", category: "Core" },
  { key: "tasks", label: "משימות", route: "/tasks", category: "Tasks" },
  { key: "reorder", label: "תכנון רכש", route: "/reorder", category: "Tasks" },
  { key: "reports", label: "דוחות", route: "/reports", category: "Tasks" },
  { key: "documents", label: "מסמכים", route: "/documents", category: "Documents" },
  { key: "issues", label: "תקלות", route: "/issues", category: "Documents" },
  { key: "alerts", label: "התראות", route: "/alerts", category: "Documents" },
  { key: "waste", label: "ניהול בלאי", route: "/waste-management", category: "Warehouse" },
  { key: "equipment", label: "ניהול חטיבות", route: "/equipment", category: "Warehouse" },
  { key: "shipment-groups", label: "קבוצות משלוח", route: "/shipment-groups", category: "Warehouse" },
  { key: "logistics-map", label: "מפת מחסן", route: "/logistics-map", category: "Warehouse" },
  { key: "lock-control", label: "בקרת נעילה", route: "/lock-control", category: "Warehouse" },
];

export function canView(permissions: RolePermissions, moduleKey: string): boolean {
  const level = permissions[moduleKey];
  return level === "view" || level === "edit";
}

export function canEdit(permissions: RolePermissions, moduleKey: string): boolean {
  return permissions[moduleKey] === "edit";
}

export function getModuleKeyFromRoute(pathname: string): string | null {
  // Extract the first path segment: "/products/123" -> "/products"
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  const mod = MODULES.find((m) => m.route === base);
  return mod?.key ?? null;
}

export function getFullPermissionsForManager(): RolePermissions {
  return Object.fromEntries(MODULES.map((m) => [m.key, "edit" as PermissionLevel]));
}

// Division managers (non-MANAGER role with a division) only get a curated UI:
// their own division, products, orders, suppliers, and waste management.
export const DIVISION_MANAGER_ALLOWED_PREFIXES = [
  "/products",
  "/orders",
  "/suppliers",
  "/waste-management",
  "/equipment/division",
  "/equipment/installer",
];

export function isDivisionManagerAllowedPath(pathname: string): boolean {
  return DIVISION_MANAGER_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isDivisionManager(user: { role: string; division?: string | null } | null | undefined): boolean {
  return !!user && user.role !== "MANAGER" && !!user.division;
}

/**
 * Resolves the effective per-module permission map for a user.
 *
 * MANAGER (or no signed-in user) gets full access. For everyone else, the
 * lookup key into `role_permissions.role` is:
 *   - `roleDefinition.system_key` when the user's `role_definition_id` points
 *     at a role definition with a system_key (system roles share their key)
 *   - the role definition's `id` (UUID) otherwise (custom roles)
 *   - the user's `role` column when no `role_definition_id` is set
 *
 * Modules with no matching permission row default to `"none"`.
 */
export function resolveCurrentUserPermissions(
  currentUser: { role: string; role_definition_id?: string | null } | null | undefined,
  roleDefinitions: Array<{ id: string; system_key: string | null }>,
  rolePermissions: Array<{ role: string; module_key: string; permission_level: PermissionLevel }>,
): RolePermissions {
  if (!currentUser || currentUser.role === "MANAGER") {
    return getFullPermissionsForManager();
  }

  let effectiveRoleKey: string = currentUser.role;
  if (currentUser.role_definition_id) {
    const rd = roleDefinitions.find((r) => r.id === currentUser.role_definition_id);
    if (rd) effectiveRoleKey = rd.system_key ?? rd.id;
  }

  const perms: RolePermissions = {};
  for (const mod of MODULES) {
    const record = rolePermissions.find(
      (rp) => rp.role === effectiveRoleKey && rp.module_key === mod.key,
    );
    perms[mod.key] = record?.permission_level ?? "none";
  }
  return perms;
}
